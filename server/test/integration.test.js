// Explicit opt-in: npm run test:integration. Uses the existing Atlas configuration.
// Creates uniquely named fixtures in pa2, and cleans up only those exact fixture IDs.
require("dotenv").config({ path: require("node:path").join(__dirname, "../.env"), quiet: true });
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { initializeProjects } = require("../projects");
const { serve } = require("./helpers");

test("Atlas integration: auth, projects, memberships, indexes and transaction rollback", { timeout: 120000 }, async t => {
    assert.ok(process.env.MONGO_URI, "Configure server/.env first.");
    const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    try { await client.connect(); } catch (error) {
        await client.close();
        throw new Error(`Atlas connection failed (${error.name}); connection details withheld.`);
    }
    const db = client.db("pa2");
    const prefix = `pa3_test_${randomUUID()}`;
    const usernames = [0, 1, 2].map(index => `${prefix}_${index}`);
    const projectNames = ["Planning", "Active", "Completed", "Rollback"].map(name => `${prefix}_${name}`);
    t.after(async () => {
        try {
            const ownedProjects = await db.collection("Projects").find({ name: { $in: projectNames } }).toArray();
            const ids = ownedProjects.map(p => p._id);
            await db.collection("ProjectMemberships").deleteMany({ project_id: { $in: ids } });
            await db.collection("Projects").deleteMany({ _id: { $in: ids } });
            await db.collection("users").deleteMany({ username: { $in: usernames } });
            assert.equal(await db.collection("Projects").countDocuments({ name: { $in: projectNames } }), 0);
            assert.equal(await db.collection("users").countDocuments({ username: { $in: usernames } }), 0);
        } finally { await client.close(); }
    });
    await initializeProjects(db);
    const api = await serve(t, db, client);
    let people, first, second;

    await t.test("existing signup/login and public user projection", async () => {
        for (const username of usernames) {
            await api("POST", "/signup", { f_name: "PA3 Test", l_name: "User", username, password: "Test-only-418" }, 201);
        }
        await api("POST", "/signup", { f_name: "A", l_name: "B", username: usernames[0], password: "x" }, 409);
        await api("POST", "/signup", {}, 400);
        await api("POST", "/login", { username: usernames[0], password: "Test-only-418" }, 200);
        await api("POST", "/login", { username: usernames[0], password: "wrong" }, 401);
        await api("POST", "/login", { username: `${prefix}_absent`, password: "wrong" }, 401);
        await api("POST", "/login", {}, 400);
        const all = await api("GET", "/api/users");
        for (const user of all) assert.deepEqual(Object.keys(user).sort(), ["_id", "f_name", "l_name", "username"]);
        people = usernames.map(name => all.find(user => user.username === name));
        assert.ok(people.every(Boolean));
    });

    await t.test("all statuses, actual ObjectIds, automatic lead memberships", async () => {
        const created = [];
        for (const [index, status] of ["Planning", "Active", "Completed"].entries()) {
            const result = await api("POST", "/api/projects", {
                name: projectNames[index], description: " Integration test ", status, project_lead_id: people[index]._id,
            }, 201);
            created.push(result.project);
            const stored = await db.collection("Projects").findOne({ _id: new ObjectId(result.project._id) });
            assert.ok(stored.project_lead_id instanceof ObjectId);
            assert.equal(stored.description, "Integration test");
            const members = await api("GET", `/api/projects/${result.project._id}/members`);
            assert.equal(members.length, 1);
            assert.equal(members[0].user_id, people[index]._id);
            const membership = await db.collection("ProjectMemberships").findOne({ _id: new ObjectId(members[0]._id) });
            assert.ok(membership.project_id instanceof ObjectId);
            assert.ok(membership.user_id instanceof ObjectId);
        }
        [first, second] = created;
        const list = await api("GET", "/api/projects");
        assert.ok(created.every(p => list.some(item => item._id === p._id)));
    });

    await t.test("required fields, invalid IDs/status, nonexistent lead/project/user", async () => {
        const valid = { name: "Invalid project", description: "D", status: "Planning", project_lead_id: people[0]._id };
        for (const field of Object.keys(valid)) {
            const body = { ...valid }; delete body[field];
            await api("POST", "/api/projects", body, 400);
        }
        for (const change of [{ name: " " }, { description: " " }, { status: "active" }, { project_lead_id: "invalid" }]) {
            await api("POST", "/api/projects", { ...valid, ...change }, 400);
        }
        await api("POST", "/api/projects", { ...valid, project_lead_id: new ObjectId() }, 404);
        for (const [id, code] of [["invalid", 400], [new ObjectId().toHexString(), 404]]) {
            await api("GET", `/api/projects/${id}/members`, undefined, code);
            await api("POST", `/api/projects/${id}/members`, { user_id: people[0]._id }, code);
            await api("DELETE", `/api/projects/${id}/members/${people[0]._id}`, undefined, code);
        }
        await api("POST", `/api/projects/${first._id}/members`, { user_id: "invalid" }, 400);
        await api("POST", `/api/projects/${first._id}/members`, {}, 400);
        await api("POST", `/api/projects/${first._id}/members`, { user_id: new ObjectId() }, 404);
        await api("DELETE", `/api/projects/${first._id}/members/invalid`, undefined, 400);
        await api("DELETE", `/api/projects/${first._id}/members/${new ObjectId()}`, undefined, 404);
    });

    await t.test("many-to-many, duplicate rejection, lead protection, removal", async () => {
        for (const p of [first, second]) {
            await api("POST", `/api/projects/${p._id}/members`, { user_id: people[2]._id }, 201);
        }
        await api("POST", `/api/projects/${first._id}/members`, { user_id: people[2]._id }, 409);
        await api("POST", `/api/projects/${first._id}/members`, { user_id: people[0]._id }, 409);
        await api("DELETE", `/api/projects/${first._id}/members/${people[0]._id}`, undefined, 400);
        await api("DELETE", `/api/projects/${first._id}/members/${people[2]._id}`, undefined, 200);
        await api("DELETE", `/api/projects/${first._id}/members/${people[2]._id}`, undefined, 404);
        const remaining = await api("GET", `/api/projects/${first._id}/members`);
        assert.deepEqual(remaining.map(m => m.user_id), [people[0]._id]);
        assert.ok((await api("GET", `/api/projects/${second._id}/members`)).some(m => m.user_id === people[2]._id));
    });

    await t.test("concurrent adds and database uniqueness index", async () => {
        // Issue simultaneous requests without fixing which one wins.
        const serverResults = [];
        const { createApp } = require("../app");
        const { once } = require("node:events");
        const server = createApp(db, client).listen(0, "127.0.0.1");
        await once(server, "listening");
        try {
            await Promise.all([0, 1].map(async () => {
                const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects/${first._id}/members`, {
                    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: people[1]._id }),
                });
                await response.json(); serverResults.push(response.status);
            }));
            assert.deepEqual(serverResults.sort(), [201, 409]);
        } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
        const pair = { project_id: new ObjectId(first._id), user_id: new ObjectId(people[1]._id) };
        assert.equal(await db.collection("ProjectMemberships").countDocuments(pair), 1);
        await assert.rejects(db.collection("ProjectMemberships").insertOne(pair), { code: 11000 });
        const indexes = await db.collection("ProjectMemberships").indexes();
        assert.ok(indexes.some(index => index.name === "unique_project_member" && index.unique));
    });

    await t.test("failed lead membership insert rolls back the project in real MongoDB", async () => {
        const faultDb = { collection(name) {
            const collection = db.collection(name);
            if (name !== "ProjectMemberships") return collection;
            return new Proxy(collection, { get(target, key) {
                if (key === "insertOne") return async () => { throw new Error("Injected membership failure"); };
                const value = target[key];
                return typeof value === "function" ? value.bind(target) : value;
            } });
        } };
        const failingApi = await serve(t, faultDb, client);
        await failingApi("POST", "/api/projects", {
            name: projectNames[3], description: "Rollback test", status: "Planning", project_lead_id: people[0]._id,
        }, 500);
        assert.equal(await db.collection("Projects").countDocuments({ name: projectNames[3] }), 0);
    });
});
