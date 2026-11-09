const { test } = require("node:test");
const assert = require("node:assert/strict");
const { ObjectId } = require("mongodb");
const { serve } = require("./helpers");

function sameValue(left, right) {
    if (left instanceof ObjectId && right instanceof ObjectId) return left.equals(right);
    return left === right;
}

function matches(document, filter) {
    return Object.entries(filter).every(([key, value]) => sameValue(document[key], value));
}

function collection(initial = []) {
    const documents = [...initial];
    return {
        createIndex: async () => "index",
        find(filter = {}) {
            const cursor = {
                sort() { return cursor; },
                toArray: async () => documents.filter(document => matches(document, filter)),
            };
            return cursor;
        },
        findOne: async filter => documents.find(document => matches(document, filter)) || null,
        insertOne: async document => {
            const insertedId = document._id || new ObjectId();
            documents.push({ ...document, _id: insertedId });
            return { insertedId };
        },
        updateOne: async (filter, update) => {
            const document = documents.find(item => matches(item, filter));
            if (document) Object.assign(document, update.$set);
            return { modifiedCount: document ? 1 : 0 };
        },
        deleteOne: async filter => {
            const index = documents.findIndex(document => matches(document, filter));
            if (index < 0) return { deletedCount: 0 };
            documents.splice(index, 1);
            return { deletedCount: 1 };
        },
    };
}

test("user stories support project scoping, assignment updates, and immutable project ownership", async t => {
    const projectId = new ObjectId();
    const userId = new ObjectId();
    const db = {
        collection(name) {
            if (!this.collections) this.collections = new Map();
            if (!this.collections.has(name)) this.collections.set(name, collection());
            return this.collections.get(name);
        },
    };
    db.collection("users").insertOne({ _id: userId, f_name: "Test", l_name: "User", username: "story-user" });
    db.collection("Projects").insertOne({ _id: projectId, name: "Story project", project_lead_id: userId });
    const api = await serve(t, db, { startSession() {} });

    const created = await api("POST", "/api/user-stories", {
        project_id: projectId.toHexString(), title: "First story",
        description: "As a user, I want a backlog, so that work is visible.",
        priority: "High", status: "To Do", assigned_user_id: userId.toHexString(),
    }, 201);
    assert.equal(created.story.project_id, projectId.toHexString());
    assert.equal(created.story.assigned_user_id, userId.toHexString());

    const listed = await api("GET", `/api/projects/${projectId}/stories`);
    assert.equal(listed.length, 1);
    const updated = await api("PATCH", `/api/user-stories/${created.story._id}`, { status: "Done" });
    assert.equal(updated.story.status, "Done");
    await api("PATCH", `/api/user-stories/${created.story._id}`, { project_id: new ObjectId().toHexString() }, 400);
    await api("DELETE", `/api/user-stories/${created.story._id}`, undefined, 200);
    await api("GET", `/api/projects/${projectId}/stories`);
});
