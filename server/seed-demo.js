require("dotenv").config({ path: require("node:path").join(__dirname, ".env"), quiet: true });

const { MongoClient, ObjectId } = require("mongodb");
const { initializeProjects } = require("./projects");

const DEMO_DB_NAME = "pa4_dev";
const DEMO_USERS = [
    { username: "ZeyuPan2005", f_name: "Zeyu", l_name: "Pan" },
    { username: "LinxuanSui2004", f_name: "Linxuan", l_name: "Sui" },
    { username: "FangruiLiu2004", f_name: "Fangrui", l_name: "Liu" },
];
const DEMO_PROJECTS = [
    {
        name: "Campus Event Platform",
        description: "Plan and coordinate campus events for students and organizers.",
        lead: "ZeyuPan2005",
        member: "LinxuanSui2004",
    },
    {
        name: "Study Planner",
        description: "Organize study schedules and track progress toward academic goals.",
        lead: "FangruiLiu2004",
        member: "LinxuanSui2004",
    },
];
const DEMO_STORIES = [
    {
        project: "Campus Event Platform",
        title: "View upcoming events",
        description: "As a student, I want to view upcoming events, so that I can decide which activities to attend.",
        priority: "High",
        status: "To Do",
        assignee: "LinxuanSui2004",
    },
    {
        project: "Campus Event Platform",
        title: "Search campus events",
        description: "As a student, I want to search campus events, so that I can quickly find relevant activities.",
        priority: "Medium",
        status: "In Progress",
        assignee: "ZeyuPan2005",
    },
    {
        project: "Campus Event Platform",
        title: "Save favorite events",
        description: "As a student, I want to save favorite events, so that I can revisit them before deciding.",
        priority: "Low",
        status: "Done",
        assignee: null,
    },
    {
        project: "Study Planner",
        title: "Create study schedule",
        description: "As a student, I want to create a study schedule, so that I can plan time for each subject.",
        priority: "High",
        status: "In Progress",
        assignee: "LinxuanSui2004",
    },
    {
        project: "Study Planner",
        title: "Track completed tasks",
        description: "As a student, I want to track completed tasks, so that I can measure my study progress.",
        priority: "Low",
        status: "Done",
        assignee: "FangruiLiu2004",
    },
];

async function ensureUser(users, spec, password) {
    const existing = await users.findOne({ username: spec.username });
    if (existing) return { user: existing, action: "reused" };
    const user = { ...spec, password };
    const result = await users.insertOne(user);
    return { user: { ...user, _id: result.insertedId }, action: "created" };
}

async function ensureProject(db, spec, usersByName) {
    const projects = db.collection("Projects");
    const memberships = db.collection("ProjectMemberships");
    let project = await projects.findOne({ name: spec.name });
    let action = "reused";
    if (!project) {
        project = {
            _id: new ObjectId(),
            name: spec.name,
            description: spec.description,
            status: "Planning",
            project_lead_id: usersByName.get(spec.lead)._id,
        };
        await projects.insertOne(project);
        action = "created";
    } else if (!new ObjectId(project.project_lead_id).equals(usersByName.get(spec.lead)._id)) {
        throw new Error(`Existing demo project ${spec.name} has a different project lead.`);
    }
    await memberships.updateOne(
        { project_id: project._id, user_id: usersByName.get(spec.lead)._id },
        { $setOnInsert: { project_id: project._id, user_id: usersByName.get(spec.lead)._id } },
        { upsert: true }
    );
    await memberships.updateOne(
        { project_id: project._id, user_id: usersByName.get(spec.member)._id },
        { $setOnInsert: { project_id: project._id, user_id: usersByName.get(spec.member)._id } },
        { upsert: true }
    );
    return { project, action };
}

async function ensureStory(db, spec, projectsByName, usersByName) {
    const stories = db.collection("UserStories");
    const project = projectsByName.get(spec.project);
    const existing = await stories.findOne({ project_id: project._id, title: spec.title });
    if (existing) return "reused";

    // Match the normal To Do -> updated status progression for demo records.
    // This seed script writes directly to MongoDB rather than calling the HTTP API.
    const story = {
        _id: new ObjectId(),
        project_id: project._id,
        title: spec.title,
        description: spec.description,
        priority: spec.priority,
        status: "To Do",
        assigned_user_id: spec.assignee ? usersByName.get(spec.assignee)._id : null,
    };
    await stories.insertOne(story);
    if (spec.status !== "To Do") {
        await stories.updateOne(
            { _id: story._id, project_id: project._id },
            { $set: { status: spec.status } }
        );
    }
    return "created";
}

async function seedDemo() {
    if (process.env.MONGO_DB_NAME !== DEMO_DB_NAME) {
        throw new Error("Demo seeding requires MONGO_DB_NAME=pa4_dev.");
    }
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required for demo seeding.");
    if (!process.env.PA4_DEMO_PASSWORD) throw new Error("PA4_DEMO_PASSWORD is required for new demo users.");

    const client = new MongoClient(process.env.MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DEMO_DB_NAME);
        await initializeProjects(db);

        const usersByName = new Map();
        const userSummary = [];
        for (const spec of DEMO_USERS) {
            const result = await ensureUser(db.collection("users"), spec, process.env.PA4_DEMO_PASSWORD);
            usersByName.set(spec.username, result.user);
            userSummary.push(`${spec.username} (${result.action})`);
        }

        const projectsByName = new Map();
        const projectSummary = [];
        for (const spec of DEMO_PROJECTS) {
            const result = await ensureProject(db, spec, usersByName);
            projectsByName.set(spec.name, result.project);
            projectSummary.push(`${spec.name} (${result.action})`);
        }

        const storySummary = [];
        for (const spec of DEMO_STORIES) {
            const action = await ensureStory(db, spec, projectsByName, usersByName);
            storySummary.push(`${spec.title} (${action})`);
        }

        console.log("PA4 demo data is ready in pa4_dev.");
        console.log(`Users: ${userSummary.join(", ")}`);
        console.log(`Projects: ${projectSummary.join(", ")}`);
        console.log(`Stories: ${storySummary.join(", ")}`);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    seedDemo().catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}

module.exports = { seedDemo, DEMO_USERS, DEMO_PROJECTS, DEMO_STORIES };
