import express from 'express';
import http from 'http';
import path from 'path';
import { Server as ColyseusServer, Room } from 'colyseus';
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------
// Define a Colyseus Room for matchmaking & lobby
// ------------------------------------------------
class FighterRoom extends Room {
    onCreate(options) {
        // Store custom room name in metadata
        this.metadata = { name: options.roomName };
        console.log(`[Colyseus] Room created: ${options.roomName}`);
    }

    onJoin(client, options) {
        console.log(`[Colyseus] Client ${client.sessionId} joined room ${this.metadata.name}`);
        // Optionally broadcast current state or player list
    }

    onLeave(client, consented) {
        console.log(`[Colyseus] Client ${client.sessionId} left room ${this.metadata.name}`);
    }

    onMessage(client, message) {
        // Handle in-room messages or relay to other peers
        this.broadcast("message", { from: client.sessionId, data: message });
    }

    onDispose() {
        console.log(`[Colyseus] Room disposed: ${this.metadata.name}`);
    }
}


// ------------------------------------------
// Setup Express + Colyseus game server
// ------------------------------------------
const app = express();
const httpServer = http.createServer(app);
const gameServer = new ColyseusServer({ server: httpServer });

// Serve static files (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '..')));

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public/joinRoom.html')));

// Define Colyseus room type 'fighter_room'
gameServer.define('fighter_room', FighterRoom);

// Start the server on port 2567
const PORT = process.env.PORT || 2567;
httpServer.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));