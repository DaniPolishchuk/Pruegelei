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

// — HTML routes —
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (req, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (req, res) => res.sendFile(path.join(__dirname, 'BackgroundSelection', 'backgroundSelection.html')));
app.get('/fight', (req, res) => res.sendFile(path.join(__dirname, 'fight.html')));

// — SQLite + REST endpoints —
const db = new Database('Fighters.db');
function bufferToBase64(buf) { return `data:image/png;base64,${buf.toString('base64')}`; }

app.get('/fighters', (req, res) => {
    console.log('[REST] GET /fighters');
    const fighters = db.prepare("SELECT * FROM Fighters").all();
    fighters.forEach(f => {
        ['Idle', 'Run', 'Jump', 'Fall', 'Attack1', 'Attack2', 'Attack3', 'Attack4', 'TakeHit', 'Death']
            .forEach(k => f[k] && (f[k] = bufferToBase64(f[k])));
        if (!f.Attack2) Object.assign(f, {
            Attack2: f.Attack1, Attack2Frames: f.Attack1Frames,
            Attack2Width: f.Attack1Width, Attack2Height: f.Attack1Height
        });
        if (!f.Attack3) Object.assign(f, {
            Attack3: f.Attack2, Attack3Frames: f.Attack2Frames,
            Attack3Width: f.Attack2Width, Attack3Height: f.Attack2Height
        });
        if (!f.Attack4) Object.assign(f, {
            Attack4: f.Attack3, Attack4Frames: f.Attack3Frames,
            Attack4Width: f.Attack3Width, Attack4Height: f.Attack3Height
        });
    });
    res.json(fighters);
});

app.get('/backgrounds', (req, res) => {
    console.log('[REST] GET /backgrounds');
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
    console.log(`[REST] GET /backgrounds/${req.params.name}/video`);
    const row = db.prepare("SELECT BorderBackground FROM Backgrounds WHERE Name = ?")
        .get(req.params.name);
    if (!row || !row.BorderBackground) {
        console.warn(`[REST] Video not found for "${req.params.name}"`);
        return res.status(404).send("Video not found");
    }
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': row.BorderBackground.length
    });
    res.end(row.BorderBackground);
});

// — WebSocket setup —
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

/**
 * rooms: { [roomName]: Array<{ clientId, ws, playerId }> }
 * cleanupTimers: { [roomName]: Timeout }
 **/
const rooms = {};
const cleanupTimers = {};

function broadcastRooms() {
    const list = Object.entries(rooms)
        .map(([name, arr]) => ({ name, count: arr.length }))
        .filter(r => r.count < 2);
    console.log('[WS] broadcastRooms →', list);
    const msg = JSON.stringify({ type: 'roomsList', rooms: list });
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

wss.on('connection', ws => {
    console.log('[WS] new connection');
    ws.clientId = null;
    ws.room = null;

    // Immediately send lobby state
    broadcastRooms();

    ws.on('message', raw => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            console.error('[WS] invalid JSON:', err);
            return;
        }
        const { type, room: incomingRoom, clientId } = data;
        ws.clientId = clientId;
        console.log(`[WS] recv "${type}" from clientId=${ws.clientId} (ws.room=${ws.room})`);

        // Cancel any pending cleanup for this room
        if (ws.room && cleanupTimers[ws.room]) {
            clearTimeout(cleanupTimers[ws.room]);
            delete cleanupTimers[ws.room];
            console.log(`[WS] cleared cleanupTimer for room="${ws.room}"`);
        }

        switch (type) {
            case 'getRooms':
                broadcastRooms();
                return;

            case 'createRoom': {
                if (!rooms[incomingRoom]) rooms[incomingRoom] = [];
                let e = rooms[incomingRoom].find(x => x.clientId === clientId);
                if (!e) {
                    e = { clientId, ws, playerId: 1 };
                    rooms[incomingRoom].push(e);
                    console.log(`[WS] created room="${incomingRoom}" (playerId=1)`);
                } else {
                    e.ws = ws;
                    console.log(`[WS] reattached host to room="${incomingRoom}"`);
                }
                ws.room = incomingRoom;
                ws.send(JSON.stringify({ type: 'roomCreated', room: incomingRoom }));
                broadcastRooms();
                return;
            }

            case 'joinRoom': {
                if (!rooms[incomingRoom]) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room not found.' }));
                    console.warn(`[WS] joinRoom failed—room="${incomingRoom}" not exist`);
                    return;
                }
                let e = rooms[incomingRoom].find(x => x.clientId === clientId);
                if (e) {
                    // rejoin
                    e.ws = ws;
                    ws.room = incomingRoom;
                    console.log(`[WS] client="${clientId}" rejoined as playerId=${e.playerId}`);
                    ws.send(JSON.stringify({ type: 'roomJoined', room: incomingRoom, playerId: e.playerId }));
                    if (rooms[incomingRoom].length === 2) {
                        rooms[incomingRoom].forEach(x => {
                            x.ws.send(JSON.stringify({ type: 'roomJoined', room: incomingRoom, playerId: x.playerId }));
                        });
                    }
                    broadcastRooms();
                    return;
                }
                if (rooms[incomingRoom].length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room is full.' }));
                    console.warn(`[WS] joinRoom failed—room="${incomingRoom}" full`);
                    return;
                }
                e = { clientId, ws, playerId: rooms[incomingRoom].length + 1 };
                rooms[incomingRoom].push(e);
                ws.room = incomingRoom;
                console.log(`[WS] client="${clientId}" joined room="${incomingRoom}" as playerId=${e.playerId}`);
                rooms[incomingRoom].forEach(x => {
                    x.ws.send(JSON.stringify({ type: 'roomJoined', room: incomingRoom, playerId: x.playerId }));
                });
                broadcastRooms();
                return;
            }

            case 'gameStart': {
                const roomName = ws.room;
                if (!roomName || !rooms[roomName]) {
                    console.warn(`[WS] gameStart failed—no room on ws`);
                    return;
                }
                const rows = db.prepare("SELECT Name FROM Backgrounds").all();
                const names = rows.map(r => r.Name);
                const choice = names[Math.floor(Math.random() * names.length)];
                console.log(`[WS] gameStart: picked "${choice}" for room="${roomName}"`);
                rooms[roomName].forEach(x => {
                    if (x.ws.readyState === WebSocket.OPEN) {
                        x.ws.send(JSON.stringify({ type: 'gameStart', background: choice }));
                    }
                });
                return;
            }

            default:
                // relay fighterSelected, ready, etc.
                const relayRoom = ws.room;
                if (relayRoom && rooms[relayRoom]) {
                    console.log(`[WS] relaying "${type}" in room="${relayRoom}"`);
                    rooms[relayRoom].forEach(x => {
                        if (x.clientId !== ws.clientId && x.ws.readyState === WebSocket.OPEN) {
                            x.ws.send(raw);
                        }
                    });
                } else {
                    console.warn(`[WS] cannot relay "${type}"—ws.room="${relayRoom}" invalid`);
                }
        }
    });

    ws.on('close', () => {
        console.log(`[WS] connection closed for clientId=${ws.clientId} room=${ws.room}`);
        const roomName = ws.room;
        if (!roomName || !rooms[roomName]) return;
        // only schedule cleanup once per room
        if (!cleanupTimers[roomName]) {
            cleanupTimers[roomName] = setTimeout(() => {
                console.log(`[WS] cleaning up empty room="${roomName}"`);
                delete rooms[roomName];
                delete cleanupTimers[roomName];
                broadcastRooms();
            }, 10000);
            console.log(`[WS] scheduled cleanup for room="${roomName}" in 10s`);
        }
    });
});

server.listen(5001, '0.0.0.0', () => {
    console.log('Server listening on http://0.0.0.0:5001');
});
