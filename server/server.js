// Load the existing configuration next to this file, regardless of terminal directory.
require("dotenv").config({ path: require("node:path").join(__dirname, ".env"), quiet: true });
const { MongoClient } = require("mongodb");
const { createApp } = require("./app");
const { initializeProjects } = require("./projects");

async function start() {
    let client;
    try {
        client = new MongoClient(process.env.MONGO_URI);
        await client.connect();
        const db = client.db("pa2");
        await initializeProjects(db);
        console.log("Connected to MongoDB");
        // Do not accept requests until the connection and uniqueness index are ready.
        const server = createApp(db, client).listen(9000, () => {
            console.log("Server running on port 9000");
        });
        server.on("error", async (error) => {
            console.error("Could not start HTTP server. Error code:", error.code);
            await client.close();
            process.exitCode = 1;
        });
        async function shutdown() {
            server.close(async () => { await client.close(); });
            server.closeIdleConnections();
        }
        process.once("SIGINT", shutdown);
        process.once("SIGTERM", shutdown);
        return server;
    } catch (error) {
        // Retain the existing diagnostic name/code without printing connection details.
        console.error("Could not connect to MongoDB or initialize project memberships.");
        console.error("Error name:", error.name);
        console.error("Error code:", error.code);
        if (client) await client.close();
        process.exitCode = 1;
    }
}

if (require.main === module) start();
module.exports = { start };
