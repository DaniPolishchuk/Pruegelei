// /FighterSelection/index.js

// ————————————————————————————————————————————————————————————————
// 1) Connect and *join* your existing room
const socket = io();
let clientId = localStorage.getItem("clientId");
if (!clientId) {
        clientId = Date.now() +  "_" + Math.random().toString(36).slice(2);
        localStorage.setItem("clientId", clientId);
    }
const room = sessionStorage.getItem("room");
socket.on("connect", () => {
      socket.emit("joinRoom", { roomName: room, clientId });
    });

// ————————————————————————————————————————————————————————————————
// 2) Wait for the server to tell us our room & playerId
let myId = null;
socket.on("roomJoined", ({ playerAssignments }) => {
    const me = playerAssignments.find(p => p.clientId === clientId);
    if (!me) return alert("Failed to re‑join lobby, please reload.");
    myId = me.playerId;
    initSelection();
});

// ————————————————————————————————————————————————————————————————
// 3) MiniFighter: draw & animate a little sprite preview
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
const grid = document.getElementById("availableFighters");
const ready1Btn = document.getElementById("readyButton1");
const ready2Btn = document.getElementById("readyButton2");
const startBtn = document.getElementById("startButton");
const c1 = document.getElementById("player1canvas");
const c2 = document.getElementById("player2canvas");

// match CSS dimensions
c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;

// our big previews
const p1 = new MiniFighter(c1);
const p2 = new MiniFighter(c2);
p2.flipped = true;

// 5) helper to fetch JSON
async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Fetch ${path} → ${res.status}`);
    return res.json();
}

// ————————————————————————————————————————————————————————————————
// 6) Kick off the selection UI once we know our playerId
async function initSelection() {
    // hide all until picks happen
    ready1Btn.style.visibility = "hidden";
    ready2Btn.style.visibility = "hidden";
    startBtn.style.visibility = "hidden";

    // disable the other player’s ready
    console.log(myId);
    ready1Btn.disabled = (myId !== 1);
    ready2Btn.disabled = (myId !== 2);

    // fetch all fighters once
    const fighters = await fetchJSON("/fighters");

    // track state
    let selLocal = false;
    let selRemote = false;
    let readyLocal = false;
    let readyRemote = false;

    function refreshStart() {
        startBtn.style.visibility =
            (selLocal && selRemote && readyLocal && readyRemote) ? "visible" : "hidden";
    }

    // build the grid
    fighters.forEach(f => {
        const btn = document.createElement("button");
        btn.className = "fighter";
        const cvs = document.createElement("canvas");
        cvs.className = "miniCanvas";
        // 1) add to the DOM so it gets laid out
        btn.appendChild(cvs);
        grid.appendChild(btn);
        // 2) now read its actual on‑screen size…
        const { width, height } = cvs.getBoundingClientRect();
        // 3) then set the internal buffer (must be integers)
        cvs.width  = Math.floor(width);
        cvs.height = Math.floor(height);

        const mf = new MiniFighter(
            cvs,
            f.Idle,
            f.SelectionMenuScale,
            f.IdleFrames,
            { x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY }
        );
        cvs._mf = mf;

        btn.onclick = () => {
            if (selLocal) return;
            // set your big preview
            const tgt = (myId === 1 ? p1 : p2);
            tgt.img.src = f.Idle;
            tgt.scale = f.SelectedScale;
            tgt.framesMax = f.IdleFrames;
            tgt.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
            selLocal = true;

            // store YOUR choice
            sessionStorage.setItem(`player${myId}`, f.Name);

            // tell the other side
            socket.emit("fighterSelected", {
                room,
                fighterName: f.Name,
                playerId: myId
            });

            ; (myId === 1 ? ready1Btn : ready2Btn).style.visibility = "visible";
            refreshStart();
        };
    });

    // when your opponent picks
    socket.on("fighterSelected", ({ fighterName, playerId }) => {
        if (playerId === myId) return;
        const f = fighters.find(x => x.Name === fighterName);
        const tgt = (playerId === 1 ? p1 : p2);
        tgt.img.src = f.Idle;
        tgt.scale = f.SelectedScale;
        tgt.framesMax = f.IdleFrames;
        tgt.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
        selRemote = true;

        // store THEIR choice
        sessionStorage.setItem(`player${playerId}`, fighterName);

        ; (playerId === 1 ? ready1Btn : ready2Btn).style.visibility = "visible";
        refreshStart();
    });

    // when either toggles ready
    socket.on("ready", ({ playerId, ready }) => {
        if (playerId === myId) readyLocal = ready;
        else readyRemote = ready;

        console.log("orange");

        const btn = (playerId === 1 ? ready1Btn : ready2Btn);
        btn.style.backgroundColor = ready ? "orange" : "black";
        btn.style.color = ready ? "black" : "orange";

        refreshStart();
    });

    // hook up your ready buttons
    ready1Btn.onclick = () => {
        if (myId !== 1 || !selLocal) return;
        readyLocal = !readyLocal;
        console.log("orange");
        socket.emit("ready", { room, playerId: 1, ready: readyLocal });
        refreshStart();
    };
    ready2Btn.onclick = () => {
        if (myId !== 2 || !selLocal) return;
        readyLocal = !readyLocal;
        socket.emit("ready", { room, playerId: 2, ready: readyLocal });
        refreshStart();
    };

    // only one of you ever clicks “Start”
    startBtn.onclick = () => {
        // sanity check that both names are stored
        if (!sessionStorage.getItem("player1") || !sessionStorage.getItem("player2")) {
            return alert("Waiting for both fighters to be picked...");
        }
        socket.emit("startGame", room);
    };

    // when the server says “GO!”, both pages redirect
    socket.on("gameStart", () => {
        window.location.href = "/background";
    });
}

// ————————————————————————————————————————————————————————————————
// 7) Draw loop for all MiniFighters (big + small)
function animate() {
    requestAnimationFrame(animate);
    p1.update();
    p2.update();
    document.querySelectorAll(".miniCanvas").forEach(c => c._mf.update());
}
animate();
