// ==========================
// Imports & Global Setup
// ==========================
import {
    getFighters,
    player1canvas,
    player2canvas,
    readyButton1,
    readyButton2,
    startButton,
    videoSource,
    videoElement
} from "../utils.js";
import {MiniFighter} from "../classes.js";

const player1 = new MiniFighter(player1canvas, null);
const player2 = new MiniFighter(player2canvas, null);
player2.flipped = true;

videoSource.src = '/defaultBorderBackground/video';
videoElement.load();

const allFighters = [];
let myId = null;

const socket = io();
let clientId = localStorage.getItem("clientId");
if (!clientId) {
    clientId = Date.now() + "_" + Math.random().toString(36).slice(2);
    localStorage.setItem("clientId", clientId);
}
const room = sessionStorage.getItem("room");

// ==========================
// Socket Connection & Join
// ==========================
socket.on("connect", () => {
    socket.emit("joinRoom", {roomName: room, clientId});
});

socket.on("roomJoined", ({playerAssignments}) => {
    const me = playerAssignments.find(p => p.clientId === clientId);
    if (!me) return alert("Failed to re-join. Reload.");
    myId = me.playerId;
    fillDivWithFighters();
});

// ==========================
// Animation Loop
// ==========================
function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
    allFighters.forEach(f => f.update());
}

animate();

// ==========================
// Fighter Selection
// ==========================
async function fillDivWithFighters() {
    const parent = document.getElementById("availableFighters");
    parent.innerHTML = "";

    getFighters().then(fighters => {
        for (const fighter of fighters) {
            let newButton = document.createElement("button");
            newButton.className = "fighter";

            let newCanvas = document.createElement("canvas");
            newCanvas.className = "miniCanvas";
            newButton.appendChild(newCanvas);
            parent.appendChild(newButton);

            newCanvas.width = newButton.offsetWidth;
            newCanvas.height = newButton.offsetHeight;

            allFighters.push(new MiniFighter(
                newCanvas,
                fighter.Idle,
                fighter.SelectionMenuScale,
                fighter.IdleFrames,
                {
                    x: fighter.SelectionMenuOffsetX,
                    y: fighter.SelectionMenuOffsetY,
                }
            ));

            newButton.addEventListener("click", () => {
                socket.emit("fighterSelected", {room, fighterName: fighter.Name, playerId: myId});
                sessionStorage.setItem(`player${myId}`, fighter.Name);
                setFighter(myId, fighter);
            });
        }
    });
}

function setFighter(playerId, fighter) {
    const tgt = (playerId === 1 ? player1 : player2);
    tgt.setImage(fighter.Idle);
    tgt.scale = fighter.SelectedScale;
    tgt.framesMax = fighter.IdleFrames;
    tgt.offset = {
        x: fighter.SelectedOffsetX,
        y: fighter.SelectedOffsetY
    };
    tgt.framesCurrent = 0;
    tgt.name = fighter.Name;

    if (playerId === 1) readyButton1.style.visibility = "visible";
    if (playerId === 2) readyButton2.style.visibility = "visible";
}

socket.on("fighterSelected", ({fighterName, playerId}) => {
    getFighters().then(fighters => {
        const f = fighters.find(x => x.Name === fighterName);
        if (f) setFighter(playerId, f);
    });
    sessionStorage.setItem(`player${playerId}`, fighterName);
});

// ==========================
// Ready State Handling
// ==========================
let readyStates = {1: false, 2: false};

function toggleReady(id) {
    if (myId !== id) return;
    readyStates[id] = !readyStates[id];
    updateReadyButton(id, readyStates[id]);
    socket.emit("ready", {room, playerId: id, ready: readyStates[id]});
    refreshStartButton();
}

function updateReadyButton(id, state) {
    const btn = id === 1 ? readyButton1 : readyButton2;
    btn.style.backgroundColor = state ? "orange" : "black";
    btn.style.color = state ? "black" : "orange";
    btn.pressed = state;
}

function refreshStartButton() {
    startButton.style.visibility =
        (readyStates[1] && readyStates[2]) ? "visible" : "hidden";
}

socket.on("ready", ({playerId, ready}) => {
    readyStates[playerId] = ready;
    updateReadyButton(playerId, ready);
    refreshStartButton();
});

// ==========================
// Start Game Flow
// ==========================
function startBgPicking() {
    sessionStorage.setItem("player1", player1.name);
    sessionStorage.setItem("player2", player2.name);
    startButton.disabled = true;
    socket.emit("startGame", room);
}

socket.on("gameStart", () => {
    window.location.href = "/background";
});

readyButton1.addEventListener("click", () => toggleReady(1));
readyButton2.addEventListener("click", () => toggleReady(2));
startButton.addEventListener("click", startBgPicking);
