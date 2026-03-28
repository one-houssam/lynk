const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3333;
const HOST = "0.0.0.0";
const ROOT_DIR = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
};

const clients = new Map();

function broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const ws of clients.keys()) {
        if (ws.readyState === ws.OPEN) {
            ws.send(message);
        }
    }
}

function broadcastUsers() {
    const users = [...clients.values()]
        .map((client) => client.username)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));

    broadcast({ type: "users", users });
}

function sendSystem(content) {
    broadcast({ type: "system", content });
}

function getSafeFilePath(urlPath) {
    const decodedPath = decodeURIComponent(urlPath || "/");
    const cleanedPath = decodedPath === "/" || decodedPath === "\\"
        ? "index.html"
        : decodedPath.replace(/^[/\\]+/, "");

    const resolved = path.resolve(ROOT_DIR, cleanedPath);

    if (!resolved.startsWith(path.resolve(ROOT_DIR))) {
        return null;
    }

    return resolved;
}

const server = http.createServer((req, res) => {
    const rawPath = req.url.split("?")[0];
    const filePath = getSafeFilePath(rawPath);

    if (!filePath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404);
            res.end("Not Found");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
    clients.set(ws, { username: "" });

    ws.on("message", (raw) => {
        let payload;
        try {
            payload = JSON.parse(raw.toString());
        } catch {
            return;
        }

        if (payload.type === "join") {
            const requested = String(payload.username || "").trim();
            const fallback = `User-${Math.floor(Math.random() * 900 + 100)}`;
            const username = requested || fallback;

            clients.set(ws, { username });
            broadcastUsers();
            sendSystem(`${username} joined`);
            return;
        }

        if (payload.type === "chat") {
            const client = clients.get(ws);
            const content = String(payload.content || "").trim();
            if (!client || !client.username || !content) {
                return;
            }

            broadcast({
                type: "chat",
                username: client.username,
                content
            });
        }
    });

    ws.on("close", () => {
        const client = clients.get(ws);
        clients.delete(ws);

        if (client && client.username) {
            sendSystem(`${client.username} left`);
        }

        broadcastUsers();
    });
});

server.listen(PORT, HOST, () => {
    console.log(`Lynk server running on http://localhost:${PORT}`);
    console.log("Press Ctrl+C to stop the server");
});
