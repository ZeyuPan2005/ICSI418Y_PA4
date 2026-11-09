const express = require("express");
const { ObjectId } = require("mongodb");

const USER_FIELDS = { _id: 1, f_name: 1, l_name: 1, username: 1 };
const STATUSES = ["Planning", "Active", "Completed"];

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
}

function projectRoutes(db, client) {
    const router = express.Router();
    const users = db.collection("users");
    const projects = db.collection("Projects");
    const memberships = db.collection("ProjectMemberships");

    router.get("/users", async (req, res) => {
        // A whitelist keeps passwords and any future private fields out of the response.
        res.json(await users.find({}, { projection: USER_FIELDS }).toArray());
    });

    router.get("/projects", async (req, res) => {
        res.json(await projects.find({}).toArray());
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
