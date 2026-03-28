const state = {
    currentUser: "",
    users: [],
    messages: [],
    socket: null,
    connected: false
};

const ui = {
    usersList: document.getElementById("usersList"),
    messages: document.getElementById("messages"),
    messageInput: document.getElementById("messageInput"),
    sendButton: document.getElementById("sendButton"),
    onlineCount: document.getElementById("onlineCount"),
    connectionStatus: document.getElementById("connectionStatus"),
    statusDot: document.getElementById("statusDot")
};

function setConnectionStatus(isConnected) {
    state.connected = isConnected;
    ui.connectionStatus.textContent = isConnected ? "Connected" : "Disconnected";
    ui.statusDot.classList.toggle("connected", isConnected);
}

function renderUsers() {
    ui.usersList.innerHTML = "";
    state.users.forEach((username) => {
        const item = document.createElement("li");
        item.textContent = username;
        ui.usersList.appendChild(item);
    });

    ui.onlineCount.textContent = String(state.users.length);
}

function renderMessage(message) {
    const item = document.createElement("div");
    item.className = `message ${message.type === "system" ? "system" : ""}`.trim();

    if (message.type === "system") {
        item.textContent = message.content;
    } else {
        const user = document.createElement("span");
        user.className = "user";
        user.textContent = message.username;

        const text = document.createElement("span");
        text.textContent = message.content;

        item.appendChild(user);
        item.appendChild(text);
    }

    ui.messages.appendChild(item);
    ui.messages.scrollTop = ui.messages.scrollHeight;
}

function addMessage(message) {
    state.messages.push(message);
    renderMessage(message);
}

function sendMessage() {
    const content = ui.messageInput.value.trim();
    if (!content || !state.connected || !state.socket) {
        return;
    }

    state.socket.send(JSON.stringify({
        type: "chat",
        content
    }));

    ui.messageInput.value = "";
    ui.messageInput.focus();
}

function setUsers(users) {
    state.users = users;
    renderUsers();
}

function setupEvents() {
    ui.sendButton.addEventListener("click", sendMessage);
    ui.messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendMessage();
        }
    });
}

function connectSocket() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socketUrl = `${protocol}://${window.location.host}`;
    const socket = new WebSocket(socketUrl);

    socket.addEventListener("open", () => {
        state.socket = socket;
        setConnectionStatus(true);
        socket.send(JSON.stringify({
            type: "join",
            username: state.currentUser
        }));
    });

    socket.addEventListener("message", (event) => {
        let payload;
        try {
            payload = JSON.parse(event.data);
        } catch {
            return;
        }

        if (payload.type === "users") {
            setUsers(payload.users || []);
            return;
        }

        if (payload.type === "system" || payload.type === "chat") {
            addMessage(payload);
        }
    });

    socket.addEventListener("close", () => {
        setConnectionStatus(false);
        state.socket = null;
        setUsers([]);
        addMessage({ type: "system", content: "Disconnected. Trying to reconnect..." });
        setTimeout(connectSocket, 1500);
    });

    socket.addEventListener("error", () => {
        socket.close();
    });
}

function askUsername() {
    const input = window.prompt("Enter your username", `User-${Math.floor(Math.random() * 900 + 100)}`);
    const name = (input || "").trim();
    state.currentUser = name || `User-${Math.floor(Math.random() * 900 + 100)}`;
}

function init() {
    askUsername();
    setConnectionStatus(false);
    renderUsers();
    setupEvents();
    connectSocket();
    ui.messageInput.focus();
}

init();