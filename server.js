// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));  // serve everything in project root

// --- SQLite setup ---
const db = new Database('Fighters.db');
function bufferToBase64(buff) {
    return `data:image/png;base64,${buff.toString('base64')}`;
}

// --- HTML routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (req, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (req, res) => res.sendFile(path.join(__dirname, 'backgroundSelection.html')));
app.get('/fight', (req, res) => res.sendFile(path.join(__dirname, 'fight.html')));

// --- REST APIs ---
// 1) Fighters
app.get('/fighters', (req, res) => {
    const fighters = db.prepare("SELECT * FROM Fighters").all();
    fighters.forEach(f => {
        ['Idle', 'Run', 'Jump', 'Fall', 'Attack1', 'Attack2', 'Attack3', 'Attack4', 'TakeHit', 'Death']
            .forEach(k => { if (f[k]) f[k] = bufferToBase64(f[k]); });
        if (!f.Attack2) f.Attack2 = f.Attack1, Object.assign(f, {
            Attack2Frames: f.Attack1Frames,
            Attack2Width: f.Attack1Width,
            Attack2Height: f.Attack1Height
        });
        if (!f.Attack3) f.Attack3 = f.Attack2, Object.assign(f, {
            Attack3Frames: f.Attack2Frames,
            Attack3Width: f.Attack2Width,
            Attack3Height: f.Attack2Height
        });
        if (!f.Attack4) f.Attack4 = f.Attack3, Object.assign(f, {
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
        if (bg.BorderBackground) bg.BorderBackground = `/backgrounds/${encodeURIComponent(bg.Name)}/video`;
    });
    res.json(bgs);
});
app.get('/backgrounds/:name/video', (req, res) => {
    const row = db.prepare("SELECT BorderBackground FROM Backgrounds WHERE Name = ?")
        .get(req.params.name);
    if (!row || !row.BorderBackground) {
        return res.status(404).send("Video not found");
    }
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': row.BorderBackground.length
    });
    res.end(row.BorderBackground);
});

// --- WebSocket rooms ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = {};  // { [roomName]: Set<clientId> }

wss.on('connection', ws => {
    ws.clientId = null;

    const broadcast = () => {
        const list = Object.entries(rooms).map(([name, set]) => ({ name, count: set.size }));
        wss.clients.forEach(c => {
            if (c.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({ type: 'roomsList', rooms: list }));
            }
        });
    };

    ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        const { type, room, clientId } = msg;
        ws.clientId = clientId;

        if (type === 'getRooms') {
            broadcast();
        }
        if (type === 'createRoom') {
            rooms[room] = rooms[room] || new Set();
            rooms[room].add(clientId);
            ws.send(JSON.stringify({ type: 'roomCreated', room, playerId: 1 }));
            broadcast();
        }
        if (type === 'joinRoom') {
            if (rooms[room] && rooms[room].size < 2) {
                rooms[room].add(clientId);
                ws.send(JSON.stringify({
                    type: 'roomJoined',
                    room,
                    playerId: rooms[room].size
                }));
                broadcast();
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room full or missing' }));
            }
        }
    });

    ws.on('close', () => {
        Object.entries(rooms).forEach(([name, set]) => {
            set.delete(ws.clientId);
            if (!set.size) delete rooms[name];
        });
        broadcast();
    });
});

server.listen(5001, () => {
    console.log('Server running on http://0.0.0.0:5001');
});
