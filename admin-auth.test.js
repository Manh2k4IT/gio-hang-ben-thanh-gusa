const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const { installAdminAuth } = require("./admin-auth");

test("admin auth gates admin pages and APIs, persists and revokes sessions", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gusa-auth-test-"));
    const email = "auth@example.test";
    const password = crypto.randomBytes(24).toString("hex");
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
    const originalEnv = {
        ADMIN_EMAIL: process.env.ADMIN_EMAIL,
        ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
        DATA_DIR: process.env.DATA_DIR
    };
    let server;
    let origin;

    async function stop() {
        if (!server) return;
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        server = null;
    }

    t.after(async () => {
        await stop();
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await fs.rm(directory, { recursive: true, force: true });
    });

    async function start(passwordHash = hash) {
        process.env.ADMIN_EMAIL = email;
        process.env.ADMIN_PASSWORD_HASH = passwordHash;
        process.env.DATA_DIR = directory;
        const app = express();
        app.set("trust proxy", 1);
        app.use(express.json());
        installAdminAuth(app);
        app.get("/products/all", (req, res) => res.json({ success: true }));
        app.get("/orders", (req, res) => res.json({ success: true }));
        app.get("/traffic-insights", (req, res) => res.json({ success: true }));
        app.get("/shop.html", (req, res) => res.send("shop"));
        app.get("/products", (req, res) => res.json([]));
        app.post("/product/add", (req, res) => res.json({ success: true }));
        app.get("/admin.html", (req, res) => res.send("admin"));
        app.get("/admin-login.html", (req, res) => res.send("login"));
        server = await new Promise((resolve) => {
            const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
        });
        origin = `http://127.0.0.1:${server.address().port}`;
    }

    const request = (url, options = {}) => fetch(origin + url, options);
    const login = (body = { email, password }, headers = {}) => request("/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Request": "1", ...headers },
        body: JSON.stringify(body)
    });

    await start();
    for (const url of ["/admin.html", "/ADMIN.html", "/admin%2ehtml"]) {
        const response = await request(url, { redirect: "manual" });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get("location"), "/admin-login.html");
    }
    for (const url of ["/products/all", "/orders", "/traffic-insights"]) {
        assert.equal((await request(url)).status, 401);
    }
    assert.equal((await request("/shop.html")).status, 200);
    assert.equal((await request("/products")).status, 200);
    assert.equal((await login({ email, password: "wrong" })).status, 401);
    assert.equal((await login({ email, password }, { Origin: "https://evil.example" })).status, 403);

    const loggedIn = await login();
    assert.equal(loggedIn.status, 200);
    const setCookie = loggedIn.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(";")[0];
    assert.equal((await request("/admin.html", { headers: { cookie } })).status, 200);
    assert.equal((await request("/traffic-insights", { headers: { cookie } })).status, 200);
    assert.equal((await request("/product/add", { method: "POST", headers: { cookie } })).status, 403);
    assert.equal((await request("/product/add", {
        method: "POST",
        headers: { cookie, "X-Admin-Request": "1", Origin: "https://evil.example" }
    })).status, 403);
    assert.equal((await request("/product/add", {
        method: "POST",
        headers: { cookie, "X-Admin-Request": "1" }
    })).status, 200);

    const stored = await fs.readFile(path.join(directory, "admin-sessions.json"), "utf8");
    assert.equal(stored.includes(cookie.split("=")[1]), false);
    assert.equal(stored.includes(password), false);

    await stop();
    await start();
    assert.equal((await request("/admin.html", { headers: { cookie } })).status, 200);
    assert.equal((await request("/orders", { headers: { cookie } })).status, 200);

    const logout = await request("/admin/auth/logout", {
        method: "POST",
        headers: { cookie, "X-Admin-Request": "1" }
    });
    assert.equal(logout.status, 200);
    assert.equal((await request("/orders", { headers: { cookie } })).status, 401);
    await stop();
    await start();
    assert.equal((await request("/orders", { headers: { cookie } })).status, 401);
});
