"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSocket = getSocket;
exports.reconnectSocket = reconnectSocket;
exports.disconnectSocket = disconnectSocket;
const socket_io_client_1 = require("socket.io-client");
let socket = null;
function getAuthPayload() {
    const token = typeof window !== "undefined" ? localStorage.getItem("nexchat_token") : null;
    return token ? { token } : {};
}
function getSocket(options = {}) {
    const { connect = true } = options;
    if (!socket) {
        socket = (0, socket_io_client_1.io)({
            path: "/socket.io",
            transports: ["websocket"],
            autoConnect: false,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            randomizationFactor: 0.5,
            auth: getAuthPayload(),
        });
    }
    if (connect && socket.disconnected) {
        socket.auth = getAuthPayload();
        socket.connect();
    }
    return socket;
}
function reconnectSocket() {
    const activeSocket = getSocket({ connect: false });
    activeSocket.auth = getAuthPayload();
    if (activeSocket.connected)
        activeSocket.disconnect();
    activeSocket.connect();
    return activeSocket;
}
function disconnectSocket() {
    if (socket)
        socket.disconnect();
}
