// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new Database('Fighters.db');
function bufferToBase64(buf) {
    return `data:image/png;base64,${buf.toString('base64')}`;
}

// remember which bg each room picked
const lastBackground = {};

// — static & HTML
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'joinRoom.html')));
app.get('/fighterSelection', (_, res) => res.sendFile(path.join(__dirname, 'FighterSelection', 'fighterSelection.html')));
app.get('/background', (_, res) => res.sendFile(path.join(__dirname, 'BackgroundSelection', 'backgroundSelection.html')));
app.get('/fight', (_, res) => res.sendFile(path.join(__dirname, 'Fight', 'fight.html')));

// — REST endpoints
app.get('/fighters', (_, res) => {
    const fighters = db.prepare("SELECT * FROM Fighters").all();
    fighters.forEach(f => {
        ['Idle', 'Run', 'Jump', 'Fall', 'Attack1', 'Attack2', 'Attack3', 'Attack4', 'TakeHit', 'Death']
            .forEach(k => f[k] && (f[k] = bufferToBase64(f[k])));
    });
    res.json(fighters);
});
app.get('/backgrounds', (_, res) => {
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

// — lobby & rooms
const rooms = {}; // roomName → { players: Map<clientId,{playerId,socket}>}

function getLobbyList() {
    return Object.entries(rooms)
        .map(([name, info]) => ({ name, count: info.players.size }))
        .filter(r => r.count < 2);
}

io.on('connection', socket => {
    //console.log('CONNECT', socket.id);

    // restore after client reload
    socket.on('restore', clientId => {
        for (let [roomName, info] of Object.entries(rooms)) {
            if (info.players.has(clientId)) {
                let rec = info.players.get(clientId);
                rec.socket = socket;
                socket.join(roomName);
                socket.emit('roomJoined', {
                    room: roomName,
                    playerAssignments: Array.from(info.players.entries())
                        .map(([cid, rec]) => ({ clientId: cid, playerId: rec.playerId }))
                });
                // replay a finished gameStart if it already happened:
                if (lastBackground[roomName]) {
                    socket.emit('gameStart', { background: lastBackground[roomName] });
                }
                io.emit('roomsList', getLobbyList());
                return;
            }
        }
    });

    socket.on('getRooms', () => socket.emit('roomsList', getLobbyList()));

    socket.on('createRoom', ({ roomName, clientId }) => {
        if (rooms[roomName]) return socket.emit('error', 'Room already exists');
        rooms[roomName] = { players: new Map([[clientId, { playerId: 1, socket }]]) };
        socket.join(roomName);
        socket.emit('roomCreated', { room: roomName, playerId: 1 });
        io.emit('roomsList', getLobbyList());
        console.log(`ROOM ${roomName} created by ${clientId}`);
    });

    socket.on('joinRoom', ({ roomName, clientId }) => {
        const room = rooms[roomName];
        if (!room) {
            return socket.emit('error', 'Room not found');
        }

        // if this clientId is new to the room, assign a slot (1 or 2)
        if (!room.players.has(clientId)) {
            if (room.players.size >= 2) {
                return socket.emit('error', 'Room is full');
            }
            const newPlayerId = room.players.size + 1;
            room.players.set(clientId, { playerId: newPlayerId, socket });
        } else {
            // otherwise just update the socket reference
            room.players.get(clientId).socket = socket;
        }

        socket.join(roomName);

        // build the assignment list with rec.playerId (always defined)
        const playerAssignments = Array.from(room.players.entries()).map(
            ([cid, rec]) => ({ clientId: cid, playerId: rec.playerId })
        );

        // emit back to everyone in the room
        socket.emit('roomJoined', { room: roomName, playerAssignments });
        socket.to(roomName).emit('playerJoined', { playerAssignments });
    });

    // relay picks & ready
    socket.on('fighterSelected', data => socket.to(data.room).emit('fighterSelected', data));
    socket.on('ready', data => {io.in(data.room).emit('ready', data);});

    // startGame: choose & broadcast, record for late-join
    socket.on('startGame', roomName => {
        let rows = db.prepare("SELECT Name FROM Backgrounds").all();
        let choice = rows[Math.floor(Math.random() * rows.length)].Name;
        lastBackground[roomName] = choice;
        console.log(`[SERVER] ▶ startGame for room=${roomName}, bg=${choice}`);
        io.in(roomName).emit('gameStart', { background: choice });
    });

    socket.on('disconnect', () => {
        //console.log('DISCONNECT', socket.id);
        for (let [roomName, info] of Object.entries(rooms)) {
            for (let [cid, rec] of info.players.entries()) {
                if (rec.socket === socket) rec.socket = null;
            }
            // if empty, garbage‐collect after 10s
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
    // relay any “state” onto everyone else in the room
    socket.on('state', data => {
        socket.to(data.room).emit('remoteState', data);
    });
    socket.on('playerInput', ({ roomName, key, pressed }) => {
        socket.to(roomName).emit('remoteInput', { key, pressed });
    });
    socket.on('playerAttack', ({ roomName }) => {
        socket.to(roomName).emit('remoteAttack');
    });
    socket.on('hit', ({ roomName, attackerId, defenderId, damage }) => {
        io.to(roomName).emit('confirmedHit', { defenderId, damage });
    });

});

server.listen(5001, () => console.log('Server listening on 127.0.0.0:5001'));
