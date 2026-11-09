const { once } = require("node:events");
const assert = require("node:assert/strict");
const { createApp } = require("../app");

async function serve(t, db, client) {
    const server = createApp(db, client).listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(async () => {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return async (method, path, body, expected = 200) => {
        const response = await fetch(base + path, {
            method, headers: { "Content-Type": "application/json" },
            ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
        });
        const data = await response.json();
        assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
        return data;
    };
}

module.exports = { serve };
