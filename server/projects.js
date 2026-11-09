const express = require("express");
const { ObjectId } = require("mongodb");

const USER_FIELDS = { _id: 1, f_name: 1, l_name: 1, username: 1 };
const PROJECT_STATUSES = ["Planning", "Active", "Completed"];
const STORY_PRIORITIES = ["High", "Medium", "Low"];
const STORY_STATUSES = ["To Do", "In Progress", "Done"];

function validId(value) {
    return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value) && ObjectId.isValid(value);
}

function idText(value) {
    return value instanceof ObjectId ? value.toHexString() : String(value);
}

function sameId(left, right) {
    return left instanceof ObjectId && right instanceof ObjectId
        ? left.equals(right)
        : idText(left) === idText(right);
}

async function initializeProjects(db) {
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
        res.json(await users.find({}, { projection: USER_FIELDS }).toArray());
    });

    router.get("/projects", async (req, res) => {
        res.json(await projects.find({}).toArray());
    });

    async function findProject(projectId) {
        if (!validId(projectId)) return null;
        return projects.findOne({ _id: new ObjectId(projectId) });
    }

    function parseStory(body, projectId, fallback = {}) {
        const title = body?.title === undefined ? fallback.title : body.title;
        const description = body?.description === undefined ? fallback.description : body.description;
        const priority = body?.priority === undefined ? fallback.priority : body.priority;
        const status = body?.status === undefined ? fallback.status : body.status;
        const assignedValue = body?.assigned_user_id === undefined
            ? fallback.assigned_user_id
            : body.assigned_user_id;
        const assignedUserId = assignedValue === undefined || assignedValue === "" ? null : assignedValue;

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
        if (assignedUserId !== null && !validId(assignedUserId)) {
            return { error: "Please select a valid assigned user or leave the story unassigned." };
        }
        return {
            value: {
                project_id: new ObjectId(projectId),
                title: title.trim(),
                description: description.trim(),
                priority,
                status,
                assigned_user_id: assignedUserId ? new ObjectId(assignedUserId) : null,
            },
        };
    }

    async function validateAssignment(project, assignedUserId) {
        if (!assignedUserId) return null;
        const userId = assignedUserId instanceof ObjectId ? assignedUserId : new ObjectId(assignedUserId);
        const user = await users.findOne({ _id: userId }, { projection: USER_FIELDS });
        if (!user) return { status: 404, message: "Assigned user not found." };
        const isLead = project.project_lead_id && sameId(project.project_lead_id, userId);
        const membership = await memberships.findOne({ project_id: project._id, user_id: userId });
        if (!isLead && !membership) {
            return { status: 400, message: "Assigned user must be a member of this project." };
        }
        return null;
    }

    async function listStories(req, res) {
        const { projectId } = req.params;
        if (!validId(projectId)) return res.status(400).json({ message: "Invalid project ID." });
        const project = await findProject(projectId);
        if (!project) return res.status(404).json({ message: "Project not found." });
        const cursor = stories.find({ project_id: project._id });
        const sorted = typeof cursor.sort === "function" ? cursor.sort({ priority: 1, _id: 1 }) : cursor;
        res.json(await sorted.toArray());
    }

    router.get("/projects/:projectId/stories", listStories);

    router.post("/projects/:projectId/stories", async (req, res) => {
        const { projectId } = req.params;
        if (!validId(projectId)) return res.status(400).json({ message: "Invalid project ID." });
        const project = await findProject(projectId);
        if (!project) return res.status(404).json({ message: "Project not found." });

        // New stories always begin in To Do. Later transitions use the PUT route.
        const parsed = parseStory({ ...(req.body || {}), status: "To Do" }, projectId);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        const assignmentError = await validateAssignment(project, parsed.value.assigned_user_id);
        if (assignmentError) return res.status(assignmentError.status).json({ message: assignmentError.message });

        const result = await stories.insertOne(parsed.value);
        return res.status(201).json({
            message: "User story created.",
            story: { ...parsed.value, _id: result.insertedId },
        });
    });

    async function updateStory(req, res) {
        const { projectId, storyId } = req.params;
        if (!validId(projectId)) return res.status(400).json({ message: "Invalid project ID." });
        if (!validId(storyId)) return res.status(400).json({ message: "Invalid user story ID." });

        const project = await findProject(projectId);
        if (!project) return res.status(404).json({ message: "Project not found." });
        const objectStoryId = new ObjectId(storyId);
        const existing = await stories.findOne({ _id: objectStoryId, project_id: project._id });
        if (!existing) return res.status(404).json({ message: "User story not found in this project." });

        const body = req.body || {};
        if (body.project_id !== undefined && body.project_id !== projectId) {
            return res.status(400).json({ message: "A user story cannot be moved to another project." });
        }
        const parsed = parseStory(body, projectId, {
            title: existing.title,
            description: existing.description,
            priority: existing.priority,
            status: existing.status,
            assigned_user_id: existing.assigned_user_id ? idText(existing.assigned_user_id) : null,
        });
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        const assignmentError = await validateAssignment(project, parsed.value.assigned_user_id);
        if (assignmentError) return res.status(assignmentError.status).json({ message: assignmentError.message });

        await stories.updateOne(
            { _id: objectStoryId, project_id: project._id },
            { $set: {
                title: parsed.value.title,
                description: parsed.value.description,
                priority: parsed.value.priority,
                status: parsed.value.status,
                assigned_user_id: parsed.value.assigned_user_id,
            } }
        );
        return res.json({
            message: "User story updated.",
            story: { ...existing, ...parsed.value, _id: objectStoryId },
        });
    }

    router.put("/projects/:projectId/stories/:storyId", updateStory);

    router.delete("/projects/:projectId/stories/:storyId", async (req, res) => {
        const { projectId, storyId } = req.params;
        if (!validId(projectId)) return res.status(400).json({ message: "Invalid project ID." });
        if (!validId(storyId)) return res.status(400).json({ message: "Invalid user story ID." });
        const project = await findProject(projectId);
        if (!project) return res.status(404).json({ message: "Project not found." });
        const result = await stories.deleteOne({ _id: new ObjectId(storyId), project_id: project._id });
        if (!result.deletedCount) return res.status(404).json({ message: "User story not found in this project." });
        return res.json({ message: "User story deleted." });
    });

    router.post("/projects", async (req, res) => {
        const { name, description, status, project_lead_id } = req.body || {};
        if (typeof name !== "string" || !name.trim() ||
            typeof description !== "string" || !description.trim()) {
            return res.status(400).json({ message: "Please provide a project name and description." });
        }
        if (!PROJECT_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Status must be Planning, Active, or Completed." });
        }
        if (!validId(project_lead_id)) {
            return res.status(400).json({ message: "Please select a valid Project Lead." });
        }

        const project = {
            _id: new ObjectId(),
            name: name.trim(),
            description: description.trim(),
            status,
            project_lead_id: new ObjectId(project_lead_id),
        };
        const session = client.startSession();
        try {
            const created = await session.withTransaction(async () => {
                const lead = await users.findOne({ _id: project.project_lead_id }, { session, projection: USER_FIELDS });
                if (!lead) return false;
                await projects.insertOne(project, { session });
                await memberships.insertOne({ project_id: project._id, user_id: project.project_lead_id }, { session });
                return true;
            });
            if (!created) return res.status(404).json({ message: "The selected Project Lead does not exist." });
            return res.status(201).json({ message: "Project created. The Project Lead is now a member.", project });
        } finally {
            await session.endSession();
        }
    });

    router.use("/projects/:projectId/members", async (req, res, next) => {
        if (!validId(req.params.projectId)) return res.status(400).json({ message: "Invalid project ID." });
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
            return res.status(201).json({ message: "Member added.", membership: { ...membership, _id: result.insertedId } });
        } catch (error) {
            if (error.code === 11000) return res.status(409).json({ message: "User is already a member of this project." });
            throw error;
        }
    });

    router.delete("/projects/:projectId/members/:userId", async (req, res) => {
        if (!validId(req.params.userId)) return res.status(400).json({ message: "Invalid user ID." });
        const userId = new ObjectId(req.params.userId);
        const project = res.locals.project;
        if (project.project_lead_id && sameId(project.project_lead_id, userId)) {
            return res.status(400).json({ message: "The Project Lead cannot be removed." });
        }
        const assignedStory = await stories.findOne({ project_id: project._id, assigned_user_id: userId });
        if (assignedStory) {
            return res.status(400).json({
                message: "This member has assigned stories. Reassign, unassign, or delete those stories before removing the member.",
            });
        }
        const result = await memberships.deleteOne({ project_id: project._id, user_id: userId });
        if (!result.deletedCount) return res.status(404).json({ message: "Membership not found." });
        return res.json({ message: "Member removed." });
    });

    return router;
}

module.exports = { projectRoutes, initializeProjects, STORY_PRIORITIES, STORY_STATUSES, validId };
