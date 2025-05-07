// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database('Fighters.db');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
function bufferToBase64(buf) {
    return `data:image/png;base64,${buf.toString('base64')}`;
}

// remembers which background was picked after “startGame”
const lastBackground = {};

// ────────────────────────────────────────────────────────────────────────────
// Static & HTML
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (_, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (_, res) => res.sendFile(path.join(__dirname, 'BackgroundSelection', 'backgroundSelection.html')));
app.get('/fight', (_, res) => res.sendFile(path.join(__dirname, 'Fight', 'fight.html')));
app.get('/fighterSelectionLoc', (_, res) => res.sendFile(path.join(__dirname, 'localGameMode/FighterSelection', 'fighterSelection.html')));
app.get('/backgroundLoc', (_, res) => res.sendFile(path.join(__dirname, 'localGameMode/BackgroundSelection', 'backgroundSelection.html')));
app.get('/fightLoc', (_, res) => res.sendFile(path.join(__dirname, 'localGameMode/Fight', 'fight.html')));
// ────────────────────────────────────────────────────────────────────────────
// REST endpoints
app.get('/fighters', (_, res) => {
    const fighters = db.prepare('SELECT * FROM Fighters').all();
    //fighters.forEach(f => {
    //    [
    //        'Idle', 'Run', 'Jump', 'Fall',
    //        'Attack1', 'Attack2', 'Attack3', 'Attack4',
    //        'TakeHit', 'Death'
    //    ].forEach(k => f[k] && (f[k] = bufferToBase64(f[k])));
    //});
    fighters.forEach(fighter => {
        // Convert valid images from BLOB to Base64
        if (fighter.Idle) fighter.Idle = bufferToBase64(fighter.Idle);
        if (fighter.Run) fighter.Run = bufferToBase64(fighter.Run);
        if (fighter.Jump) fighter.Jump = bufferToBase64(fighter.Jump);
        if (fighter.Fall) fighter.Fall = bufferToBase64(fighter.Fall);
        if (fighter.Attack1) fighter.Attack1 = bufferToBase64(fighter.Attack1);
        if (fighter.Attack2) fighter.Attack2 = bufferToBase64(fighter.Attack2);
        if (fighter.Attack3) fighter.Attack3 = bufferToBase64(fighter.Attack3);
        if (fighter.Attack4) fighter.Attack4 = bufferToBase64(fighter.Attack4);
        if (fighter.TakeHit) fighter.TakeHit = bufferToBase64(fighter.TakeHit);
        if (fighter.Death) fighter.Death = bufferToBase64(fighter.Death);

        // Ensure Attack2, Attack3, and Attack4 use valid images
        if (!fighter.Attack2) {
            fighter.Attack2 = fighter.Attack1;
            fighter.Attack2Frames = fighter.Attack1Frames;
            fighter.Attack2Width = fighter.Attack1Width;
            fighter.Attack2Height = fighter.Attack1Height;
        }
        if (!fighter.Attack3){
            fighter.Attack3 = fighter.Attack2;
            fighter.Attack3Frames = fighter.Attack2Frames;
            fighter.Attack3Width = fighter.Attack2Width;
            fighter.Attack3Height = fighter.Attack2Height;
        }
        if (!fighter.Attack4){
            fighter.Attack4 = fighter.Attack3;
            fighter.Attack4Frames = fighter.Attack3Frames;
            fighter.Attack4Width = fighter.Attack3Width;
            fighter.Attack4Height = fighter.Attack3Height;
        }
    });
    res.json(fighters);
});

app.get('/backgrounds', (_, res) => {
    const bgs = db.prepare('SELECT * FROM Backgrounds').all();
    bgs.forEach(bg => {
        if (bg.BackgroundImage) bg.BackgroundImage = bufferToBase64(bg.BackgroundImage);
        if (bg.BorderBackground) bg.BorderBackground = `/backgrounds/${encodeURIComponent(bg.Name)}/video`;
    });
    res.json(bgs);
});

app.get('/backgrounds/:name/video', (req, res) => {
    const row = db.prepare('SELECT BorderBackground FROM Backgrounds WHERE Name = ?')
        .get(req.params.name);
    if (!row || !row.BorderBackground) return res.status(404).send('Video not found');
    res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': row.BorderBackground.length
    });
    res.end(row.BorderBackground);
});

// ────────────────────────────────────────────────────────────────────────────
// Lobby & rooms
// rooms = { [roomName]: { players: Map<clientId, {playerId,socket,fighterName,ready}> } }
const rooms = {};

function getLobbyList() {
    return Object.entries(rooms)
        .map(([name, info]) => ({ name, count: info.players.size }))
        .filter(r => r.count < 2);
}

// ────────────────────────────────────────────────────────────────────────────
io.on('connection', socket => {

    /* ── RESTORE (F5 on client) ─────────────────────────────────────────────── */
    socket.on('restore', clientId => {
        for (const [roomName, info] of Object.entries(rooms)) {
            if (info.players.has(clientId)) {
                const rec = info.players.get(clientId);
                rec.socket = socket;
                socket.join(roomName);

                socket.emit('roomJoined', {
                    room: roomName,
                    playerAssignments: Array.from(info.players.entries())
                        .map(([cid, rec]) => ({ clientId: cid, playerId: rec.playerId }))
                });

                // send cached lobby state
                for (const p of info.players.values()) {
                    if (p.fighterName)
                        socket.emit('fighterSelected', { fighterName: p.fighterName, playerId: p.playerId });
                    socket.emit('ready', { playerId: p.playerId, ready: p.ready });
                }

                // if the match had already started, replay that too
                if (lastBackground[roomName])
                    socket.emit('gameStart', { background: lastBackground[roomName] });

                io.emit('roomsList', getLobbyList());
                return;
            }
        }
    });

    /* ── Lobby list ─────────────────────────────────────────────────────────── */
    socket.on('getRooms', () => socket.emit('roomsList', getLobbyList()));

    /* ── Create room ────────────────────────────────────────────────────────── */
    socket.on('createRoom', ({ roomName, clientId }) => {
        if (rooms[roomName]) return socket.emit('error', 'Room already exists');

        rooms[roomName] = {
            players: new Map([
                [clientId, { playerId: 1, socket, fighterName: null, ready: false }]
            ])
        };

        socket.join(roomName);
        socket.emit('roomCreated', { room: roomName, playerId: 1 });
        io.emit('roomsList', getLobbyList());
        console.log(`ROOM ${roomName} created by ${clientId}`);
    });

    /* ── Join room ──────────────────────────────────────────────────────────── */
    socket.on('joinRoom', ({ roomName, clientId }) => {
        const room = rooms[roomName];
        if (!room) return socket.emit('error', 'Room not found');
        if (!room.players.has(clientId)) {
            if (room.players.size >= 2)
                return socket.emit('error', 'Room is full');
            const newId = room.players.size + 1;
            room.players.set(clientId, {
                playerId: newId, socket,
                fighterName: null, ready: false
            });
        } else {
            room.players.get(clientId).socket = socket;
        }

        socket.join(roomName);

        const playerAssignments = Array.from(room.players.entries())
            .map(([cid, rec]) => ({ clientId: cid, playerId: rec.playerId }));

        socket.emit('roomJoined', { room: roomName, playerAssignments });

        // send cached lobby state to this newcomer
        for (const p of room.players.values()) {
            if (p.fighterName)
                socket.emit('fighterSelected', { fighterName: p.fighterName, playerId: p.playerId });
            socket.emit('ready', { playerId: p.playerId, ready: p.ready });
        }

        socket.to(roomName).emit('playerJoined', { playerAssignments });
    });

    /* ── Fighter selected ───────────────────────────────────────────────────── */
    socket.on('fighterSelected', ({ room, fighterName, playerId }) => {
        const r = rooms[room];
        if (r) {
            for (const rec of r.players.values())
                if (rec.playerId === playerId)
                    rec.fighterName = fighterName;
            }
        io.in(room).emit('fighterSelected', { fighterName, playerId });
    });

    /* ── Ready toggle ───────────────────────────────────────────────────────── */
    socket.on('ready', data => {
        const room = rooms[data.room];
        if (room) {
            for (const p of room.players.values())
                if (p.playerId === data.playerId) p.ready = data.ready;
        }
        io.in(data.room).emit('ready', data);
    });

    /* ── Start game ─────────────────────────────────────────────────────────── */
    socket.on('startGame', room=> {
        if (!lastBackground[room]) {                    // first request: roll once
            const rows= db.prepare('SELECT Name FROM Backgrounds').all();
            lastBackground[room] = rows[Math.floor(Math.random() * rows.length)].Name;
            io.in(room).emit('gameStart', {background: lastBackground[room]});
            console.log(`[SERVER] ▶ startGame room=${room}, bg=${lastBackground[room]}`);
            } else {                                        // later requests: replay
                socket.emit('gameStart', {background: lastBackground[room]});
            }
    });

    /* ── Disconnect / cleanup ───────────────────────────────────────────────── */
    socket.on('disconnect', () => {
        for (const [roomName, info] of Object.entries(rooms)) {
            for (const [cid, rec] of info.players.entries()) {
                if (rec.socket === socket) rec.socket = null;
            }
            if ([...info.players.values()].every(r => r.socket === null)) {
                setTimeout(() => {
                    if ([...info.players.values()].every(r => r.socket === null)) {
                        delete rooms[roomName];
                        delete lastBackground[roomName];
                        io.emit('roomsList', getLobbyList());
                        console.log(`CLEANUP ${roomName}`);
                    }
                }, 10_000);
            }
        }
    });

    /* ── In‑game relays (unchanged) ─────────────────────────────────────────── */
    socket.on('state', data => socket.to(data.room).emit('remoteState', data));
    socket.on('playerInput', ({ roomName, key, pressed }) => socket.to(roomName).emit('remoteInput', { key, pressed }));
    socket.on('playerAttack', ({ roomName }) => socket.to(roomName).emit('remoteAttack'));
    socket.on('hit', ({ roomName, defenderId, damage }) => io.to(roomName).emit('confirmedHit', { defenderId, damage }));

}); // io.on('connection')

server.listen(5001, () => console.log('Server listening on 127.0.0.1:5001'));
