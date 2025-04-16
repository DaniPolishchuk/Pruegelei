// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// --- SQLite helper ---
const db = new Database('Fighters.db');
function bufferToBase64(buf) {
    return `data:image/png;base64,${buf.toString('base64')}`;
}

// --- HTML routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (req, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (req, res) => res.sendFile(path.join(__dirname, 'backgroundSelection.html')));
app.get('/fight', (req, res) => res.sendFile(path.join(__dirname, 'fight.html')));

// --- REST endpoints ---
// 1) Fighters
app.get('/fighters', (req, res) => {
    const fighters = db.prepare("SELECT * FROM Fighters").all();
    fighters.forEach(f => {
        ['Idle', 'Run', 'Jump', 'Fall', 'Attack1', 'Attack2', 'Attack3', 'Attack4', 'TakeHit', 'Death']
            .forEach(k => { if (f[k]) f[k] = bufferToBase64(f[k]); });
        // fallback attacks
        if (!f.Attack2) Object.assign(f, {
            Attack2: f.Attack1,
            Attack2Frames: f.Attack1Frames,
            Attack2Width: f.Attack1Width,
            Attack2Height: f.Attack1Height
        });
        if (!f.Attack3) Object.assign(f, {
            Attack3: f.Attack2,
            Attack3Frames: f.Attack2Frames,
            Attack3Width: f.Attack2Width,
            Attack3Height: f.Attack2Height
        });
        if (!f.Attack4) Object.assign(f, {
            Attack4: f.Attack3,
            Attack4Frames: f.Attack3Frames,
            Attack4Width: f.Attack3Width,
            Attack4Height: f.Attack3Height
        });
    });
    res.json(fighters);
});

// 2) Backgrounds
app.get('/backgrounds', (req, res) => {
    const bgs = db.prepare("SELECT * FROM Backgrounds").all();
    bgs.forEach(bg => {
        if (bg.BackgroundImage) bg.BackgroundImage = bufferToBase64(bg.BackgroundImage);
        if (bg.BorderBackground) {
            bg.BorderBackground = `/backgrounds/${encodeURIComponent(bg.Name)}/video`;
        }
    });
    res.json(bgs);
});
app.get('/backgrounds/:name/video', (req, res) => {
    const row = db.prepare("SELECT BorderBackground FROM Backgrounds WHERE Name = ?")
        .get(req.params.name);
    if (!row || !row.BorderBackground) {
        console.log(`Video not found for background: ${req.params.name}`);
        return res.status(404).send("Video not found");
    }
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': row.BorderBackground.length
    });
    res.end(row.BorderBackground);
});

// --- WebSocket lobby ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/**
 * rooms: {
 *   [roomName]: [
 *     { clientId: string, ws: WebSocket, playerId: number },
 *     ...
 *   ]
 * }
 **/
const rooms = {};
/**
 * cleanupTimers: {
 *   [roomName]: Timeout
 * }
 **/
const cleanupTimers = {};

function broadcastRooms() {
    const list = Object.entries(rooms)
        .map(([name, arr]) => ({ name, count: arr.length }))
        .filter(r => r.count < 2);
    const msg = JSON.stringify({ type: 'roomsList', rooms: list });
    console.log(`Broadcasting roomsList: ${JSON.stringify(list)}`);
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) {
            c.send(msg);
        }
    });
}

wss.on('connection', ws => {
    console.log('New WebSocket connection');
    ws.clientId = null;
    ws.room = null;

    // Immediately send current rooms
    broadcastRooms();

    ws.on('message', raw => {
        let data;
        try { data = JSON.parse(raw); } catch (e) {
            console.error('Invalid JSON:', e);
            return;
        }
        const { type, room, clientId } = data;
        console.log(`Received message: type=${type}, room=${room}, clientId=${clientId}`);
        ws.clientId = clientId;

        // Cancel any pending room cleanup if host reconnected
        if (room && cleanupTimers[room]) {
            clearTimeout(cleanupTimers[room]);
            delete cleanupTimers[room];
            console.log(`Cleared cleanup timer for room ${room}`);
        }

        // 1) Client requested room list
        if (type === 'getRooms') {
            broadcastRooms();
            return;
        }

        // 2) Create a new room
        if (type === 'createRoom') {
            if (!rooms[room]) rooms[room] = [];
            let entry = rooms[room].find(e => e.clientId === clientId);
            if (!entry) {
                entry = { clientId, ws, playerId: 1 };
                rooms[room].push(entry);
            } else {
                entry.ws = ws;
            }
            ws.room = room;
            console.log(`Room "${room}" created by ${clientId}`);
            ws.send(JSON.stringify({ type: 'roomCreated', room }));
            broadcastRooms();
            return;
        }

        // 3) Join or rejoin a room
        if (type === 'joinRoom') {
            if (!rooms[room]) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room does not exist.' }));
                console.warn(`Join attempt to non-existent room "${room}" by ${clientId}`);
                return;
            }
            let entry = rooms[room].find(e => e.clientId === clientId);
            if (entry) {
                // Rejoin
                entry.ws = ws;
                ws.room = room;
                console.log(`Client ${clientId} rejoined room "${room}" as Player ${entry.playerId}`);
                ws.send(JSON.stringify({ type: 'roomJoined', room, playerId: entry.playerId }));
                // If second player already present, notify them too
                if (rooms[room].length === 2) {
                    rooms[room].forEach(e => {
                        if (e.clientId !== clientId) {
                            e.ws.send(JSON.stringify({ type: 'roomJoined', room, playerId: e.playerId }));
                        }
                    });
                }
                broadcastRooms();
                return;
            }
            // New joiner
            if (rooms[room].length >= 2) {
                ws.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
                console.warn(`Room "${room}" full; join attempt by ${clientId}`);
                return;
            }
            entry = { clientId, ws, playerId: rooms[room].length + 1 };
            rooms[room].push(entry);
            ws.room = room;
            console.log(`Client ${clientId} joined room "${room}" as Player ${entry.playerId}`);
            // Notify both
            rooms[room].forEach(e => {
                e.ws.send(JSON.stringify({ type: 'roomJoined', room, playerId: e.playerId }));
            });
            broadcastRooms();
            return;
        }

        // 4) Relay any other messages to the other participant(s) in the room
        if (ws.room && rooms[ws.room]) {
            console.log(`Relaying message type="${type}" from ${clientId} to others in room "${ws.room}"`);
            rooms[ws.room].forEach(e => {
                if (e.clientId !== clientId && e.ws.readyState === WebSocket.OPEN) {
                    e.ws.send(raw);
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`WebSocket closed for clientId=${ws.clientId} in room=${ws.room}`);
        const room = ws.room;
        if (!room || !rooms[room]) return;
        // Schedule cleanup after 10s in case the host refreshes
        cleanupTimers[room] = setTimeout(() => {
            console.log(`Cleaning up empty room "${room}" after grace period`);
            delete rooms[room];
            delete cleanupTimers[room];
            broadcastRooms();
        }, 10000);
    });
});

const PORT = 5001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
