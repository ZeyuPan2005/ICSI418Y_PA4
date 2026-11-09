const express = require("express");
const { ObjectId } = require("mongodb");

const USER_FIELDS = { _id: 1, f_name: 1, l_name: 1, username: 1 };
const STATUSES = ["Planning", "Active", "Completed"];
const STORY_PRIORITIES = ["High", "Medium", "Low"];
const STORY_STATUSES = ["To Do", "In Progress", "Done"];

// HTTP receives strings. Require exactly 24 hexadecimal characters before conversion.
function validId(value) {
    return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value) && ObjectId.isValid(value);
}

async function initializeProjects(db) {
    // The database index also protects against simultaneous duplicate requests.
    await db.collection("ProjectMemberships").createIndex(
        { project_id: 1, user_id: 1 },
        { unique: true, name: "unique_project_member" }
    );
    await db.collection("UserStories").createIndex(
        { project_id: 1, status: 1, priority: 1 },
        { name: "stories_by_project_status_priority" }
    );
}

function projectRoutes(db, client) {
    const router = express.Router();
    const users = db.collection("users");
    const projects = db.collection("Projects");
    const memberships = db.collection("ProjectMemberships");
    const stories = db.collection("UserStories");

    router.get("/users", async (req, res) => {
        // A whitelist keeps passwords and any future private fields out of the response.
        res.json(await users.find({}, { projection: USER_FIELDS }).toArray());
    });

    router.get("/projects", async (req, res) => {
        res.json(await projects.find({}).toArray());
    });

    async function findProject(projectId) {
        if (!validId(projectId)) return null;
        return projects.findOne({ _id: new ObjectId(projectId) });
    }

    function storyDocument(body, projectId) {
        const { title, description, priority, status, assigned_user_id } = body || {};
        if (typeof title !== "string" || !title.trim() ||
            typeof description !== "string" || !description.trim()) {
            return { error: "Please provide a story title and description." };
        }
        if (!STORY_PRIORITIES.includes(priority)) {
            return { error: "Priority must be High, Medium, or Low." };
        }
        if (!STORY_STATUSES.includes(status)) {
            return { error: "Status must be To Do, In Progress, or Done." };
        }
        if (assigned_user_id !== null && assigned_user_id !== undefined && !validId(assigned_user_id)) {
            return { error: "Please select a valid assigned user or leave the story unassigned." };
        }
        return {
            value: {
                project_id: new ObjectId(projectId),
                title: title.trim(),
                description: description.trim(),
                priority,
                status,
                assigned_user_id: assigned_user_id ? new ObjectId(assigned_user_id) : null,
            },
        };
    }

    async function ensureAssignedUser(userId) {
        if (!userId) return true;
        return Boolean(await users.findOne({ _id: userId }, { projection: USER_FIELDS }));
    }

    async function listStories(req, res) {
        const projectId = req.params.projectId || req.query.project_id;
        if (projectId && !validId(projectId)) return res.status(400).json({ message: "Invalid project ID." });
        if (req.params.projectId && !(await findProject(req.params.projectId))) {
            return res.status(404).json({ message: "Project not found." });
        }
        const filter = projectId ? { project_id: new ObjectId(projectId) } : {};
        const cursor = stories.find(filter);
        const sortedCursor = typeof cursor.sort === "function" ? cursor.sort({ priority: 1, _id: 1 }) : cursor;
        res.json(await sortedCursor.toArray());
    }

    // The collection-level route supports a project_id query, while the nested
    // route makes the project/backlog relationship explicit for the UI.
    router.get("/user-stories", listStories);
    router.get("/stories", listStories);
    router.get("/projects/:projectId/stories", listStories);
    router.get("/projects/:projectId/user-stories", listStories);
    router.get("/projects/:projectId/backlog", listStories);

    async function createStory(req, res) {
        const { project_id } = req.body || {};
        if (!validId(project_id)) return res.status(400).json({ message: "Please select a valid project." });
        const project = await findProject(project_id);
        if (!project) return res.status(404).json({ message: "Project not found." });
        const parsed = storyDocument(req.body, project_id);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        if (!(await ensureAssignedUser(parsed.value.assigned_user_id))) {
            return res.status(404).json({ message: "Assigned user not found." });
        }
        const result = await stories.insertOne(parsed.value);
        return res.status(201).json({ message: "User story created.", story: { ...parsed.value, _id: result.insertedId } });
    }

    router.post("/user-stories", createStory);
    router.post("/stories", createStory);
    router.post("/projects/:projectId/stories", async (req, res) => {
        req.body = { ...(req.body || {}), project_id: req.params.projectId };
        return createStory(req, res);
    });

    async function updateStory(req, res) {
        if (!validId(req.params.storyId)) return res.status(400).json({ message: "Invalid user story ID." });
        const storyId = new ObjectId(req.params.storyId);
        const existing = await stories.findOne({ _id: storyId });
        if (!existing) return res.status(404).json({ message: "User story not found." });
        const body = req.body || {};
        const existingProjectId = existing.project_id instanceof ObjectId
            ? existing.project_id.toHexString()
            : String(existing.project_id);
        if (body.project_id !== undefined && body.project_id !== existingProjectId) {
            return res.status(400).json({ message: "A user story cannot be moved to another project." });
        }
        const next = {
            title: body.title === undefined ? existing.title : body.title,
            description: body.description === undefined ? existing.description : body.description,
            priority: body.priority === undefined ? existing.priority : body.priority,
            status: body.status === undefined ? existing.status : body.status,
            assigned_user_id: body.assigned_user_id === undefined
                ? (existing.assigned_user_id instanceof ObjectId ? existing.assigned_user_id.toHexString() : existing.assigned_user_id)
                : body.assigned_user_id,
        };
        const parsed = storyDocument(next, existingProjectId);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        if (!(await ensureAssignedUser(parsed.value.assigned_user_id))) {
            return res.status(404).json({ message: "Assigned user not found." });
        }
        await stories.updateOne({ _id: storyId }, { $set: {
            title: parsed.value.title,
            description: parsed.value.description,
            priority: parsed.value.priority,
            status: parsed.value.status,
            assigned_user_id: parsed.value.assigned_user_id,
        } });
        const story = { ...existing, ...parsed.value, _id: storyId };
        return res.json({ message: "User story updated.", story });
    }

    router.patch("/user-stories/:storyId", updateStory);
    router.put("/user-stories/:storyId", updateStory);
    async function updateNestedStory(req, res, next) {
        if (!validId(req.params.projectId)) return res.status(400).json({ message: "Invalid project ID." });
        if (!validId(req.params.storyId)) return res.status(400).json({ message: "Invalid user story ID." });
        const current = await stories.findOne({ _id: new ObjectId(req.params.storyId) });
        if (!current) return res.status(404).json({ message: "User story not found." });
        const currentProjectId = current.project_id instanceof ObjectId ? current.project_id.toHexString() : String(current.project_id);
        if (currentProjectId !== req.params.projectId) return res.status(404).json({ message: "User story not found." });
        return updateStory(req, res, next);
    }
    router.patch("/projects/:projectId/stories/:storyId", updateNestedStory);
    router.put("/projects/:projectId/stories/:storyId", updateNestedStory);

    router.delete("/user-stories/:storyId", async (req, res) => {
        if (!validId(req.params.storyId)) return res.status(400).json({ message: "Invalid user story ID." });
        const result = await stories.deleteOne({ _id: new ObjectId(req.params.storyId) });
        if (!result.deletedCount) return res.status(404).json({ message: "User story not found." });
        return res.json({ message: "User story deleted." });
    });

    router.post("/projects", async (req, res) => {
        const { name, description, status, project_lead_id } = req.body || {};
        if (typeof name !== "string" || !name.trim() ||
            typeof description !== "string" || !description.trim()) {
            return res.status(400).json({ message: "Please provide a project name and description." });
        }
        if (!STATUSES.includes(status)) {
            return res.status(400).json({ message: "Status must be Planning, Active, or Completed." });
        }
        if (!validId(project_lead_id)) {
            return res.status(400).json({ message: "Please select a valid Project Lead." });
        }

        const project = {
            _id: new ObjectId(), name: name.trim(), description: description.trim(),
            status, project_lead_id: new ObjectId(project_lead_id),
        };
        // Atlas supports transactions: either both records commit, or neither does.
        // Keep these operations sequential and attach the same session to each one.
        const session = client.startSession();
        try {
            const created = await session.withTransaction(async () => {
                const lead = await users.findOne({ _id: project.project_lead_id }, { session, projection: USER_FIELDS });
                if (!lead) return false;
                await projects.insertOne(project, { session });
                await memberships.insertOne({
                    project_id: project._id, user_id: project.project_lead_id,
                }, { session });
                return true;
            });
            if (!created) return res.status(404).json({ message: "The selected Project Lead does not exist." });
            return res.status(201).json({ message: "Project created. The Project Lead is now a member.", project });
        } finally {
            await session.endSession();
        }
    });

    // All member routes share project-ID validation and the project-existence check.
    router.use("/projects/:projectId/members", async (req, res, next) => {
        if (!validId(req.params.projectId)) {
            return res.status(400).json({ message: "Invalid project ID." });
        }
        const project = await projects.findOne({ _id: new ObjectId(req.params.projectId) });
        if (!project) return res.status(404).json({ message: "Project not found." });
        res.locals.project = project;
        next();
    });

    router.get("/projects/:projectId/members", async (req, res) => {
        res.json(await memberships.find({ project_id: res.locals.project._id }).toArray());
    });

    router.post("/projects/:projectId/members", async (req, res) => {
        const userId = req.body?.user_id;
        if (!validId(userId)) return res.status(400).json({ message: "Please select a valid user." });
        const user = await users.findOne({ _id: new ObjectId(userId) }, { projection: USER_FIELDS });
        if (!user) return res.status(404).json({ message: "User not found." });
        const membership = { project_id: res.locals.project._id, user_id: user._id };
        if (await memberships.findOne(membership)) {
            return res.status(409).json({ message: "User is already a member of this project." });
        }
        try {
            const result = await memberships.insertOne(membership);
            res.status(201).json({ message: "Member added.", membership: { ...membership, _id: result.insertedId } });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({ message: "User is already a member of this project." });
            }
            throw error;
        }
    });

    router.delete("/projects/:projectId/members/:userId", async (req, res) => {
        if (!validId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID." });
        const userId = new ObjectId(req.params.userId);
        const project = res.locals.project;
        if (project.project_lead_id.equals(userId)) {
            return res.status(400).json({ message: "The Project Lead cannot be removed." });
        }
        const result = await memberships.deleteOne({ project_id: project._id, user_id: userId });
        if (!result.deletedCount) return res.status(404).json({ message: "Membership not found." });
        res.json({ message: "Member removed." });
    });

    return router;
}

module.exports = { projectRoutes, initializeProjects };
