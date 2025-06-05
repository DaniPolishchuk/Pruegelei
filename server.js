/* eslint-disable prettier/prettier */
// ==========================
// Imports & Setup
// ==========================
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new Database("Fighters.db");

// ==========================
// Utility
// ==========================
function bufferToBase64(buf) {
  return `data:image/png;base64,${buf.toString("base64")}`;
}

const lastBackground = {};
const rooms = {};

function getLobbyList() {
  return Object.entries(rooms)
    .map(([name, info]) => ({ name, count: info.players.size }))
    .filter((r) => r.count < 2);
}

const rematchResponses = {};
const reselectResponses = {};

const roomTimers = {};
const DEFAULT_ROUND_TIME = 100;

// ==========================
// Static Routes
// ==========================
app.use(express.static(path.join(__dirname, ".")));

app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "StartMenu", "startMenu.html")),
);
app.get(["/fighterSelection", "/fighterSelectionL"], (_, res) =>
  res.sendFile(
    path.join(__dirname, "FighterSelection", "fighterSelection.html"),
  ),
);
app.get(["/background", "/backgroundL"], (_, res) =>
  res.sendFile(
    path.join(__dirname, "BackgroundSelection", "backgroundSelection.html"),
  ),
);
app.get(["/fight", "/fightL"], (_, res) =>
  res.sendFile(path.join(__dirname, "Fight", "fight.html")),
);

// ==========================
// REST: Fighters / Backgrounds / Shield
// ==========================
app.get("/fighters", (_, res) => {
  const fighters = db.prepare("SELECT * FROM Fighters").all();
  fighters.forEach((fighter) => {
    if (fighter.idle) fighter.idle = bufferToBase64(fighter.idle);
    if (fighter.run) fighter.run = bufferToBase64(fighter.run);
    if (fighter.jump) fighter.jump = bufferToBase64(fighter.jump);
    if (fighter.fall) fighter.fall = bufferToBase64(fighter.fall);
    if (fighter.attack1) fighter.attack1 = bufferToBase64(fighter.attack1);
    if (fighter.attack2) fighter.attack2 = bufferToBase64(fighter.attack2);
    if (fighter.attack3) fighter.attack3 = bufferToBase64(fighter.attack3);
    if (fighter.attack4) fighter.attack4 = bufferToBase64(fighter.attack4);
    if (fighter.takeHit) fighter.takeHit = bufferToBase64(fighter.takeHit);
    if (fighter.death) fighter.death = bufferToBase64(fighter.death);
    if (fighter.block) {
      fighter.block = bufferToBase64(fighter.block);
    }

    if (!fighter.attack2) {
      fighter.attack2 = fighter.attack1;
      fighter.attack2Frames = fighter.attack1Frames;
      fighter.attack2Width = fighter.attack1Width;
      fighter.attack2Height = fighter.attack1Height;
    }
    if (!fighter.attack3) {
      fighter.attack3 = fighter.attack2;
      fighter.attack3Frames = fighter.attack2Frames;
      fighter.attack3Width = fighter.attack2Width;
      fighter.attack3Height = fighter.attack2Height;
    }
    if (!fighter.attack4) {
      fighter.attack4 = fighter.attack3;
      fighter.attack4Frames = fighter.attack3Frames;
      fighter.attack4Width = fighter.attack3Width;
      fighter.attack4Height = fighter.attack3Height;
    }
  });
  res.json(fighters);
});

app.get("/backgrounds", (_, res) => {
  const bgs = db.prepare("SELECT * FROM Backgrounds").all();
  bgs.forEach((bg) => {
    if (bg.backgroundImage)
      bg.backgroundImage = bufferToBase64(bg.backgroundImage);
    if (bg.borderBackground) {
      bg.borderBackground = `/backgrounds/${encodeURIComponent(bg.name)}/video`;
    }
  });
  res.json(bgs);
});

app.get("/backgrounds/:name/video", (req, res) => {
  const row = db
    .prepare("SELECT borderBackground FROM Backgrounds WHERE name = ?")
    .get(req.params.name);
  if (!row || !row.borderBackground)
    return res.status(404).send("Video not found");
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": row.borderBackground.length,
  });
  res.end(row.borderBackground);
});

app.get("/shield", (_, res) => {
  const shield = db.prepare("SELECT * FROM Shield").get();
  shield.image = bufferToBase64(shield.image);
  res.json(shield);
});

app.get("/defaultBorderBackground", (req, res) => {
  const bg = db.prepare("SELECT * FROM DefaultBorderBackground").get();
  if (!bg) return res.status(404).json({ error: "Not found" });
  res.json({ videoLength: bg.videoSource.length });
});

app.get("/defaultBorderBackground/video", (req, res) => {
  const bg = db.prepare("SELECT * FROM DefaultBorderBackground").get();
  if (!bg || !bg.videoSource) return res.status(404).send("Video not found");
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": bg.videoSource.length,
  });
  res.end(bg.videoSource);
});

app.get("/music", (_, res) => {
  const songs = db.prepare("SELECT * FROM Music").all();
  songs.forEach((song) => {
    if (song.name) {
      song.source = `/music/${encodeURIComponent(song.name)}/source`;
    }
  });
  res.json(songs);
});

app.get("/music/:name/source", (req, res) => {
  const song = db
    .prepare("SELECT source FROM Music WHERE name = ?")
    .get(req.params.name);
  if (!song || !song.source) return res.status(404).send("Music not found");
  res.writeHead(200, {
    "Content-Type": "audio/ogg",
    "Content-Length": song.source.length,
  });
  res.end(song.source);
});

app.get("/ouch", (_, res) => {
  const ouchs = db.prepare("SELECT * FROM OuchSound").all();
  ouchs.forEach((ouch) => {
    if (ouch.gender) {
      ouch.source = `/ouch/${encodeURIComponent(ouch.gender)}/source`;
    }
  });
  res.json(ouchs);
});

app.get("/ouch/:gender/source", (req, res) => {
  const ouch = db
    .prepare("SELECT source FROM OuchSound WHERE gender = ?")
    .get(req.params.gender);
  if (!ouch || !ouch.source)
    return res.status(404).send("Ouch sound not found");
  res.writeHead(200, {
    "Content-Type": "audio/ogg",
    "Content-Length": ouch.source.length,
  });
  res.end(ouch.source);
});

// ==========================
// Socket.IO: Lobby & Game Logic
// ==========================
io.on("connection", (socket) => {
  socket.on("restore", (clientId) => {
    for (const [roomName, info] of Object.entries(rooms)) {
      if (info.players.has(clientId)) {
        const rec = info.players.get(clientId);
        rec.socket = socket;
        socket.join(roomName);

        socket.emit("roomJoined", {
          room: roomName,
          playerAssignments: Array.from(info.players.entries()).map(
            ([cid, rec]) => ({ clientId: cid, playerId: rec.playerId }),
          ),
        });

        for (const p of info.players.values()) {
          if (p.fighterName)
            socket.emit("fighterSelected", {
              fighterName: p.fighterName,
              playerId: p.playerId,
            });
          socket.emit("ready", { playerId: p.playerId, ready: p.ready });
        }

        if (lastBackground[roomName])
          socket.emit("gameStart", { background: lastBackground[roomName] });

        io.emit("roomsList", getLobbyList());
        return;
      }
    }
  });

  socket.on("getRooms", () => socket.emit("roomsList", getLobbyList()));

  socket.on("createRoom", ({ roomName, clientId }) => {
    if (rooms[roomName]) return socket.emit("error", "Room already exists");
    rooms[roomName] = {
      players: new Map([
        [clientId, { playerId: 1, socket, fighterName: null, ready: false }],
      ]),
    };
    socket.join(roomName);
    socket.emit("roomCreated", { room: roomName, playerId: 1 });
    io.emit("roomsList", getLobbyList());
  });

  socket.on("joinRoom", ({ roomName, clientId }) => {
    const room = rooms[roomName];
    if (!room) return socket.emit("error", "Room not found");

    if (!room.players.has(clientId)) {
      if (room.players.size >= 2) return socket.emit("error", "Room is full");
      const newId = room.players.size + 1;
      room.players.set(clientId, {
        playerId: newId,
        socket,
        fighterName: null,
        ready: false,
      });
    } else {
      room.players.get(clientId).socket = socket;
    }

    socket.join(roomName);

    const playerAssignments = Array.from(room.players.entries()).map(
      ([cid, rec]) => ({ clientId: cid, playerId: rec.playerId }),
    );

    socket.emit("roomJoined", { room: roomName, playerAssignments });

    for (const p of room.players.values()) {
      if (p.fighterName)
        socket.emit("fighterSelected", {
          fighterName: p.fighterName,
          playerId: p.playerId,
        });
      socket.emit("ready", { playerId: p.playerId, ready: p.ready });
    }

    socket.to(roomName).emit("playerJoined", { playerAssignments });
  });

  socket.on("fighterSelected", ({ room, fighterName, playerId }) => {
    const r = rooms[room];
    if (r) {
      for (const rec of r.players.values())
        if (rec.playerId === playerId) rec.fighterName = fighterName;
    }
    io.in(room).emit("fighterSelected", { fighterName, playerId });
  });

  socket.on("ready", (data) => {
    const room = rooms[data.room];
    if (room) {
      for (const p of room.players.values())
        if (p.playerId === data.playerId) p.ready = data.ready;
    }
    io.in(data.room).emit("ready", data);
  });

  socket.on("startGame", (room) => {
    if (!lastBackground[room]) {
      const rows = db.prepare("SELECT name FROM Backgrounds").all();
      lastBackground[room] = rows[Math.floor(Math.random() * rows.length)].name;
    }
    io.in(room).emit("gameStart", { background: lastBackground[room] });

    if (roomTimers[room]?.intervalId) {
      clearInterval(roomTimers[room].intervalId);
    }
    roomTimers[room] = {
      remaining: DEFAULT_ROUND_TIME,
      paused: false,
      intervalId: null,
    };
    io.in(room).emit("timerTick", roomTimers[room].remaining);
    roomTimers[room].intervalId = setInterval(() => {
      const t = roomTimers[room];
      if (!t.paused) {
        t.remaining--;
        io.in(room).emit("timerTick", t.remaining);
        if (t.remaining <= 0) {
          clearInterval(t.intervalId);
          io.in(room).emit("timerEnd");
        }
      }
    }, 1000);
  });

  socket.on("disconnect", () => {
    for (const [roomName, info] of Object.entries(rooms)) {
      for (const [, rec] of info.players.entries()) {
        if (rec.socket === socket) rec.socket = null;
      }
      if ([...info.players.values()].every((r) => r.socket === null)) {
        setTimeout(() => {
          if ([...info.players.values()].every((r) => r.socket === null)) {
            delete rooms[roomName];
            delete lastBackground[roomName];
            io.emit("roomsList", getLobbyList());
          }
        }, 10_000);
      }
    }
  });

  socket.on("state", (data) => socket.to(data.room).emit("remoteState", data));
  socket.on("playerInput", ({ roomName, key, pressed }) =>
    socket.to(roomName).emit("remoteInput", { key, pressed }),
  );
  socket.on("playerAttack", ({ roomName }) =>
    socket.to(roomName).emit("remoteAttack"),
  );
  socket.on("hit", ({ roomName, defenderId, damage }) =>
    io.to(roomName).emit("confirmedHit", { defenderId, damage }),
  );

  socket.on("togglePause", ({ roomName }) => {
    const t = roomTimers[roomName];
    if (!t) return;
    t.paused = !t.paused;
    io.in(roomName).emit(
      t.paused ? "timerPaused" : "timerResumed",
      t.remaining,
    );
  });

  socket.on("requestRematch", ({ roomName }) => {
    rematchResponses[roomName] = new Map();
    io.in(roomName).emit("showRematchModal");
  });

  socket.on("rematchResponse", ({ roomName, decision }) => {
    if (decision === false) {
      io.in(roomName).emit("rematchEnd");
      delete rematchResponses[roomName];
      return;
    }
    const map = rematchResponses[roomName] || new Map();
    map.set(socket.id, true);
    rematchResponses[roomName] = map;
    const total = rooms[roomName]?.players.size || 0;
    if (map.size === total) {
      io.in(roomName).emit("rematchStart");
      delete rematchResponses[roomName];
    }
  });

  socket.on("reselectResponse", ({ roomName }) => {
    const map = reselectResponses[roomName] || new Map();
    map.set(socket.id, true);
    reselectResponses[roomName] = map;

    const total = rooms[roomName]?.players.size || 0;
    if (map.size === total) {
      for (const [, rec] of rooms[roomName].players) {
        rec.fighterName = null;
        rec.ready = false;
      }

      io.in(roomName).emit("reselectFighters");

      delete reselectResponses[roomName];
      delete rematchResponses[roomName];
    }
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404Error", "404Error.html"));
});
// ==========================
// Server Start
// ==========================
const port = process.env.PORT || 5001;
server.listen(port, () =>
  console.log(`Server listening on http://127.0.0.1:${port}`),
);
