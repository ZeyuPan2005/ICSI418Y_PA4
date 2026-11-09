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

test("stories enforce project membership, full editing, and project-scoped ownership", async t => {
    const leadA = new ObjectId();
    const leadB = new ObjectId();
    const member = new ObjectId();
    const projectA = new ObjectId();
    const projectB = new ObjectId();
    const db = {
        collections: new Map(),
        collection(name) {
            if (!this.collections.has(name)) this.collections.set(name, collection());
            return this.collections.get(name);
        },
    };
    const users = db.collection("users");
    await users.insertOne({ _id: leadA, f_name: "Lead", l_name: "A", username: "lead-a" });
    await users.insertOne({ _id: leadB, f_name: "Lead", l_name: "B", username: "lead-b" });
    await users.insertOne({ _id: member, f_name: "Project", l_name: "Member", username: "member" });
    await db.collection("Projects").insertOne({ _id: projectA, name: "A", project_lead_id: leadA });
    await db.collection("Projects").insertOne({ _id: projectB, name: "B", project_lead_id: leadB });
    await db.collection("ProjectMemberships").insertOne({ project_id: projectA, user_id: leadA });
    await db.collection("ProjectMemberships").insertOne({ project_id: projectA, user_id: member });
    await db.collection("ProjectMemberships").insertOne({ project_id: projectB, user_id: leadB });
    await db.collection("ProjectMemberships").insertOne({ project_id: projectB, user_id: member });
    const api = await serve(t, db, {});

    const created = await api("POST", `/api/projects/${projectA}/stories`, {
        title: "First story",
        description: "As a student, I want a backlog, so that I can track work.",
        priority: "High",
        status: "Done",
        assigned_user_id: member.toHexString(),
    }, 201);
    assert.equal(created.story.status, "To Do");
    assert.equal(created.story.project_id, projectA.toHexString());
    assert.equal((await db.collection("UserStories").findOne({ _id: new ObjectId(created.story._id) })).status, "To Do");

    await api("POST", `/api/projects/${projectA}/stories`, {
        title: "Cross project assignment",
        description: "As a student, I want a safe assignment, so that work stays with the right team.",
        priority: "Low",
        assigned_user_id: leadB.toHexString(),
    }, 400);
    const unassigned = await api("POST", `/api/projects/${projectA}/stories`, {
        title: "Unassigned story",
        description: "As a student, I want an unassigned story, so that the team can triage it.",
        priority: "Medium",
        assigned_user_id: null,
    }, 201);
    assert.equal(unassigned.story.assigned_user_id, null);

    const edited = await api("PUT", `/api/projects/${projectA}/stories/${created.story._id}`, {
        title: "Edited story",
        description: "As an organizer, I want an edited backlog item, so that the team has clear work.",
        priority: "Low",
        status: "Done",
        assigned_user_id: member.toHexString(),
    }, 200);
    assert.equal(edited.story.title, "Edited story");
    assert.equal(edited.story.status, "Done");
    await api("PUT", `/api/projects/${projectA}/stories/${created.story._id}`, { status: "To Do" }, 200);
    await api("PUT", `/api/projects/${projectB}/stories/${created.story._id}`, { status: "Done" }, 404);
    await api("DELETE", `/api/projects/${projectB}/stories/${created.story._id}`, undefined, 404);
    await api("PUT", `/api/projects/${projectA}/stories/${created.story._id}`, { assigned_user_id: member.toHexString(), status: "Done" }, 200);
    const blocked = await api("DELETE", `/api/projects/${projectA}/members/${member}`, undefined, 400);
    assert.match(blocked.message, /Reassign, unassign, or delete/);
    await api("PUT", `/api/projects/${projectA}/stories/${created.story._id}`, { assigned_user_id: null }, 200);
    await api("DELETE", `/api/projects/${projectA}/members/${member}`, undefined, 200);

    await api("POST", `/api/projects/${projectB}/stories`, {
        title: "Other project story",
        description: "As a student, I want another project story, so that unrelated work is separate.",
        priority: "Low",
        assigned_user_id: member.toHexString(),
    }, 201);
    await api("DELETE", `/api/projects/${projectA}/members/${member}`, undefined, 404);
    await api("GET", `/api/projects/bad/stories`, undefined, 400);
    await api("POST", `/api/projects/${projectA}/stories`, { title: "x", description: "y", priority: "Urgent" }, 400);
    await api("PUT", `/api/projects/${projectA}/stories/${created.story._id}`, { status: "Paused" }, 400);
    await api("POST", `/api/projects/${projectA}/stories`, { title: " ", description: "y", priority: "High" }, 400);
    await api("POST", `/api/projects/${projectA}/stories`, { title: "x", description: " ", priority: "High" }, 400);
    await api("PUT", `/api/projects/${projectA}/stories/bad`, {}, 400);
    await api("DELETE", `/api/projects/${projectA}/stories/bad`, undefined, 400);
});
