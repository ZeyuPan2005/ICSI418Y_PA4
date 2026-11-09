const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const { serve } = require("./helpers");

const leadId = new ObjectId();
const projectId = new ObjectId();
const userId = new ObjectId();
const project = { _id: projectId, project_lead_id: leadId };
const secret = "private-database-error-must-not-reach-clients";
const brokenCollection = new Proxy({}, { get() { return () => { throw new Error(secret); }; } });

test("input validation rejects malformed requests before database access", async t => {
    const api = await serve(t, { collection: () => brokenCollection }, {});
    await api("GET", "/", undefined, 200);
    await api("GET", "/not-a-route", undefined, 404);
    await api("POST", "/api/projects", "{broken", 400);
    await api("POST", "/signup", {}, 400);
    await api("POST", "/login", { username: { $ne: null }, password: "x" }, 400);
    const body = { name: "Project", description: "Description", status: "Planning", project_lead_id: leadId.toHexString() };
    for (const change of [{ name: " " }, { description: [] }, { status: "Other" }, { project_lead_id: "bad" }, { project_lead_id: 123 }]) {
        await api("POST", "/api/projects", { ...body, ...change }, 400);
    }
    for (const method of ["GET", "POST", "DELETE"]) {
        await api(method, `/api/projects/bad/members${method === "DELETE" ? "/bad" : ""}`, method === "POST" ? {} : undefined, 400);
    }
});

test("database failures produce safe JSON on every API and existing auth route", async t => {
    const api = await serve(t, { collection: () => brokenCollection }, {
        startSession() { throw new Error(secret); },
    });
    const cases = [
        ["GET", "/api/users"], ["GET", "/api/projects"],
        ["GET", `/api/projects/${projectId}/members`],
        ["POST", `/api/projects/${projectId}/members`, { user_id: userId }],
        ["DELETE", `/api/projects/${projectId}/members/${userId}`],
        ["POST", "/api/projects", { name: "P", description: "D", status: "Active", project_lead_id: leadId }],
        ["POST", "/signup", { f_name: "A", l_name: "B", username: "u", password: "p" }],
        ["POST", "/login", { username: "u", password: "p" }],
    ];
    for (const [method, route, body] of cases) {
        const result = await api(method, route, body, 500);
        assert.equal(result.message, "A server error occurred. Please try again later.");
        assert.ok(!JSON.stringify(result).includes(secret));
    }
});

test("unique-index race is translated into HTTP 409", async t => {
    const db = { collection(name) {
        if (name === "Projects") return { findOne: async () => project };
        if (name === "users") return { findOne: async () => ({ _id: userId }) };
        return {
            findOne: async () => null,
            insertOne: async () => { throw Object.assign(new Error(secret), { code: 11000 }); },
        };
    } };
    const api = await serve(t, db, {});
    const result = await api("POST", `/api/projects/${projectId}/members`, { user_id: userId }, 409);
    assert.match(result.message, /already a member/);
});

test("lead removal is rejected even through a direct HTTP request", async t => {
    let deletes = 0;
    const db = { collection(name) {
        return name === "Projects" ? { findOne: async () => project } : {
            deleteOne: async () => { deletes++; return { deletedCount: 1 }; },
        };
    } };
    const api = await serve(t, db, {});
    await api("DELETE", `/api/projects/${projectId}/members/${leadId}`, undefined, 400);
    assert.equal(deletes, 0);
});
