// /FighterSelection/index.js
// ————————————————————————————————————————————————————————————————
// 1) Connect and *join* your existing room
const socket = io();
let clientId = localStorage.getItem('clientId');
if (!clientId) {
    clientId = Date.now() + '_' + Math.random().toString(36).slice(2);
    localStorage.setItem('clientId', clientId);
}
const room = sessionStorage.getItem('room');
socket.on('connect', () => socket.emit('joinRoom', { roomName: room, clientId }));

// ————————————————————————————————————————————————————————————————
// 2) Wait for the server to tell us our room & playerId
let myId = null;
socket.on('roomJoined', ({ playerAssignments }) => {
    const me = playerAssignments.find(p => p.clientId === clientId);
    if (!me) return alert('Failed to re‑join lobby, please reload.');
    myId = me.playerId;
    initSelection();
});

// ————————————————————————————————————————————————————————————————
// 3) Mini‑sprite helper (unchanged)
class MiniFighter {
    constructor(canvas, src, scale, framesMax, offset) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.img = new Image();
        this.loaded = false;
        this.img.onload = () => (this.loaded = true);
        this.img.onerror = () => (this.loaded = false);
        if (src) this.img.src = src;

        this.scale = scale || 1;
        this.framesMax = framesMax || 1;
        this.current = 0;
        this.elapsed = 0;
        this.hold = 4;
        this.offset = offset || { x: 0, y: 0 };
        this.flipped = false;
    }

    draw() {
        if (!this.loaded) return;
        const fw = this.img.width / this.framesMax;
        const dw = fw * this.scale;
        const dh = this.img.height * this.scale;
        const dx = -this.offset.x;
        const dy = -this.offset.y;

        if (this.flipped) {
            this.ctx.save();
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(
                this.img,
                this.current * fw, 0, fw, this.img.height,
                -(dx + dw), dy, dw, dh
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                this.img,
                this.current * fw, 0, fw, this.img.height,
                dx, dy, dw, dh
            );
        }
    }

    update() {
        this.draw();
        this.elapsed++;
        if (this.elapsed % this.hold === 0) {
            this.current = (this.current + 1) % this.framesMax;
        }
    }
}

// ————————————————————————————————————————————————————————————————
// 4) DOM refs & canvas sizing
const grid = document.getElementById('availableFighters');
const ready1Btn = document.getElementById('readyButton1');
const ready2Btn = document.getElementById('readyButton2');
const startBtn = document.getElementById('startButton');
const c1 = document.getElementById('player1canvas');
const c2 = document.getElementById('player2canvas');
c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
const p1 = new MiniFighter(c1); const p2 = new MiniFighter(c2); p2.flipped = true;

// ————————————————————————————————————————————————————————————————
// 0) EARLY BUFFER — store lobby events that arrive before initSelection is ready
const earlyBuffer = [];
socket.on('fighterSelected', data => earlyBuffer.push({ type: 'pick', data }));
socket.on('ready', data => earlyBuffer.push({ type: 'ready', data }));

// ————————————————————————————————————————————————————————————————
// 5) Kick off the selection UI once we know our playerId
async function initSelection() {

    // hide all until picks happen
    ready1Btn.style.visibility = 'hidden';
    ready2Btn.style.visibility = 'hidden';
    startBtn.style.visibility = 'hidden';

    // disable the other player’s ready button for me
    ready1Btn.disabled = (myId !== 1);
    ready2Btn.disabled = (myId !== 2);

    // fetch all fighters once
    const fighters = await fetchJSON('/fighters');

    // local state
    let selLocal = false, selRemote = false, readyLocal = false, readyRemote = false;
    const refreshStart = () => {
        startBtn.style.visibility =
            (selLocal && selRemote && readyLocal && readyRemote) ? 'visible' : 'hidden';
    };

    // build the grid of fighter buttons
    fighters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'fighter';
        const cvs = document.createElement('canvas');
        cvs.className = 'miniCanvas';
        btn.appendChild(cvs); grid.appendChild(btn);
        const { width, height } = cvs.getBoundingClientRect();
        cvs.width = Math.floor(width); cvs.height = Math.floor(height);

        const mf = new MiniFighter(cvs, f.Idle, f.SelectionMenuScale, f.IdleFrames,
            { x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY });
        cvs._mf = mf;

        btn.onclick = () => {
            if (selLocal) return;
            const tgt = (myId === 1 ? p1 : p2);
            tgt.img.src = f.Idle;
            tgt.scale = f.SelectedScale;
            tgt.framesMax = f.IdleFrames;
            tgt.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
            selLocal = true;

            sessionStorage.setItem(`player${myId}`, f.Name);
            socket.emit('fighterSelected', { room, fighterName: f.Name, playerId: myId });

            (myId === 1 ? ready1Btn : ready2Btn).style.visibility = 'visible';
            refreshStart();
        };
    });

    /* ───── real handlers now that fighters are known ───── */

    const handlePick = ({ fighterName, playerId }) => {
        if (playerId === myId) return;
        const f = fighters.find(x => x.Name === fighterName);
        const tgt = (playerId === 1 ? p1 : p2);
        tgt.img.src = f.Idle;
        tgt.scale = f.SelectedScale;
        tgt.framesMax = f.IdleFrames;
        tgt.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
        selRemote = true;

        sessionStorage.setItem(`player${playerId}`, fighterName);
        (playerId === 1 ? ready1Btn : ready2Btn).style.visibility = 'visible';
        refreshStart();
    };

    const handleReady = ({ playerId, ready }) => {
        if (playerId === myId) readyLocal = ready; else readyRemote = ready;
        const btn = (playerId === 1 ? ready1Btn : ready2Btn);
        btn.style.backgroundColor = ready ? 'orange' : 'black';
        btn.style.color = ready ? 'black' : 'orange';
        refreshStart();
    };

    // swap temporary listeners for the real ones
    socket.off('fighterSelected'); socket.off('ready');
    socket.on('fighterSelected', handlePick);
    socket.on('ready', handleReady);

    // process buffered events that arrived before we got here
    earlyBuffer.forEach(pkt => {
        if (pkt.type === 'pick') handlePick(pkt.data);
        else handleReady(pkt.data);
    });
    earlyBuffer.length = 0;

    /* ───── ready buttons ───── */
    ready1Btn.onclick = () => {
        if (myId !== 1 || !selLocal) return;
        readyLocal = !readyLocal;
        socket.emit('ready', { room, playerId: 1, ready: readyLocal });
        refreshStart();
    };
    ready2Btn.onclick = () => {
        if (myId !== 2 || !selLocal) return;
        readyLocal = !readyLocal;
        socket.emit('ready', { room, playerId: 2, ready: readyLocal });
        refreshStart();
    };

    /* ───── start button & transition ───── */
    startBtn.onclick = () => {
        if (!sessionStorage.getItem('player1') || !sessionStorage.getItem('player2'))
            return alert('Waiting for both fighters to be picked…');
        socket.emit('startGame', room);
    };
    socket.on('gameStart', () => window.location.href = '/background');
}

// ————————————————————————————————————————————————————————————————
// 6) Draw loop
function animate() {
    requestAnimationFrame(animate);
    p1.update(); p2.update();
    document.querySelectorAll('.miniCanvas').forEach(c => c._mf.update());
}
animate();

// ————————————————————————————————————————————————————————————————
// 7) fetchJSON helper
async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
}
