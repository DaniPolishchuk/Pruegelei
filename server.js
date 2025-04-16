const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

// — SQLite helper —
const db = new Database('Fighters.db');
function bufferToBase64(buf) {
    return `data:image/png;base64,${buf.toString('base64')}`;
}

// — HTML routes —
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (req, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (req, res) => res.sendFile(path.join(__dirname, 'backgroundSelection.html')));
app.get('/fight', (req, res) => res.sendFile(path.join(__dirname, 'fight.html')));

// — REST endpoints —
app.get('/fighters', (req, res) => {
    const fighters = db.prepare("SELECT * FROM Fighters").all();
    fighters.forEach(f => {
        ['Idle', 'Run', 'Jump', 'Fall', 'Attack1', 'Attack2', 'Attack3', 'Attack4', 'TakeHit', 'Death']
            .forEach(k => { if (f[k]) f[k] = bufferToBase64(f[k]); });
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
    if (!row || !row.BorderBackground) return res.status(404).send("Video not found");
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': row.BorderBackground.length
    });
    res.end(row.BorderBackground);
});

// — WebSocket lobby —
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = {}; // roomName → Set<clientId>

function broadcastRooms() {
    const list = Object.entries(rooms)
        .map(([name, set]) => ({ name, count: set.size }))
        .filter(r => r.count < 2);
    const msg = JSON.stringify({ type: 'roomsList', rooms: list });
    wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    });
}

wss.on('connection', ws => {
    ws.clientId = null;

    // Send existing rooms immediately on connect
    broadcastRooms();

    ws.on('message', raw => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        const { type, room, clientId } = data;
        ws.clientId = clientId;

        if (type === 'getRooms') {
            broadcastRooms();
        }

        if (type === 'createRoom') {
            if (!rooms[room]) rooms[room] = new Set();
            rooms[room].add(clientId);

            // **Host stays in lobby**—no redirect here
            ws.send(JSON.stringify({ type: 'roomCreated', room }));
            broadcastRooms();
        }

        if (type === 'joinRoom') {
            const set = rooms[room];
            if (set && set.size < 2) {
                set.add(clientId);

                // Notify the **joiner** as Player 2
                ws.send(JSON.stringify({ type: 'roomJoined', room, playerId: 2 }));

                // Notify the **host** still in the lobby as Player 1
                wss.clients.forEach(c => {
                    if (c !== ws && c.readyState === WebSocket.OPEN) {
                        c.send(JSON.stringify({ type: 'roomJoined', room, playerId: 1 }));
                    }
                });

                broadcastRooms();
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room is full or does not exist.' }));
            }
        }
    });

    ws.on('close', () => {
        Object.values(rooms).forEach(set => set.delete(ws.clientId));
        Object.keys(rooms).forEach(r => { if (!rooms[r].size) delete rooms[r]; });
        broadcastRooms();
    });
});

server.listen(5001, () => {
    console.log('Server listening on http://0.0.0.0:5001');
});
