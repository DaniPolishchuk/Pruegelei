const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors()); // Enable CORS for frontend requests

const db = new Database('Fighters.db');

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '.'))); // Serves files from the project folder

// API route to fetch fighters (with Base64 images)
function bufferToBase64(buffer) {
    return `data:image/png;base64,${buffer.toString('base64')}`;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'FighterSelection/fighterSelection.html'));
});

app.get('/fight', (req, res) => {
    res.sendFile(path.join(__dirname, 'Fight/fight.html'));
});

app.get('/fighters', (req, res) => {
    const fighters = db.prepare("SELECT * FROM Fighters").all();

    // Convert image BLOBs to Base64
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

// Start the server
const PORT = 5001;
app.listen(PORT, () => console.log(`Server running at http://127.0.0.1:${PORT}`));
