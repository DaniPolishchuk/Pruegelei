import { getFighters } from "../Fight/js/utils.js";
import {MiniFighter} from "../localGameMode/FighterSelection/fighterSelection.js";

const player1canvas = document.getElementById("player1canvas");
const player2canvas = document.getElementById("player2canvas");
player1canvas.width = player1canvas.offsetWidth;
player1canvas.height = player1canvas.offsetHeight;
player2canvas.width = player2canvas.offsetWidth;
player2canvas.height = player2canvas.offsetHeight;

export const player1 = new MiniFighter(player1canvas, null);
export const player2 = new MiniFighter(player2canvas, null);
player2.flipped = true;

const allFighters = [];
let myId = null;

const socket = io();
let clientId = localStorage.getItem("clientId");
if (!clientId) {
    clientId = Date.now() + "_" + Math.random().toString(36).slice(2);
    localStorage.setItem("clientId", clientId);
}
const room = sessionStorage.getItem("room");
socket.on("connect", () => socket.emit("joinRoom", { roomName: room, clientId }));
socket.on("roomJoined", ({ playerAssignments }) => {
    const me = playerAssignments.find(p => p.clientId === clientId);
    if (!me) return alert("Failed to re-join. Reload.");
    myId = me.playerId;
    fillDivWithFighters();
});

function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
    allFighters.forEach(f => f.update());
}
animate();

async function fillDivWithFighters() {
    const fighters = await getFighters();
    const parent = document.getElementById("availableFighters");
    parent.innerHTML = ""; // Prevent duplicate appends

    for (const fighter of fighters) {
        const newButton = document.createElement("button");
        newButton.className = "fighter";
        const newCanvas = document.createElement("canvas");
        newCanvas.className = "miniCanvas";
        newButton.appendChild(newCanvas);
        parent.appendChild(newButton);
        newCanvas.width = newButton.offsetWidth;
        newCanvas.height = newButton.offsetHeight;

        allFighters.push(new MiniFighter(newCanvas, fighter.Idle, fighter.SelectionMenuScale, fighter.IdleFrames, {
            x: fighter.SelectionMenuOffsetX,
            y: fighter.SelectionMenuOffsetY,
        }));

        newButton.addEventListener("click", () => {
            socket.emit("fighterSelected", { room, fighterName: fighter.Name, playerId: myId });
            sessionStorage.setItem(`player${myId}`, fighter.Name);
            setFighter(myId, fighter);
        });
    }
}

function setFighter(playerId, fighter) {
    const tgt = (playerId === 1 ? player1 : player2);
    tgt.setImage(fighter.Idle);
    tgt.scale = fighter.SelectedScale;
    tgt.framesMax = fighter.IdleFrames;
    tgt.offset = { x: fighter.SelectedOffsetX, y: fighter.SelectedOffsetY };
    tgt.framesCurrent = 0;
    tgt.name = fighter.Name;

    if (playerId === 1) readyButton1.style.visibility = "visible";
    if (playerId === 2) readyButton2.style.visibility = "visible";
}

socket.on("fighterSelected", ({ fighterName, playerId }) => {
    getFighters().then(fighters => {
        const f = fighters.find(x => x.Name === fighterName);
        if (f) setFighter(playerId, f);
    });
    sessionStorage.setItem(`player${playerId}`, fighterName);
    console.log(`player${playerId}`, fighterName);
});

export const readyButton1 = document.getElementById("readyButton1");
export const readyButton2 = document.getElementById("readyButton2");
export const startButton = document.getElementById("startButton");

readyButton1.addEventListener("click", () => toggleReady(1));
readyButton2.addEventListener("click", () => toggleReady(2));
startButton.addEventListener("click", startBgPicking);

let readyStates = { 1: false, 2: false };

function toggleReady(id) {
    if (myId !== id) return;
    readyStates[id] = !readyStates[id];
    updateReadyButton(id, readyStates[id]);
    socket.emit("ready", { room, playerId: id, ready: readyStates[id] });
    refreshStartButton();
}

function updateReadyButton(id, state) {
    const btn = id === 1 ? readyButton1 : readyButton2;
    btn.style.backgroundColor = state ? "orange" : "black";
    btn.style.color = state ? "black" : "orange";
    btn.pressed = state;
}

socket.on("ready", ({ playerId, ready }) => {
    readyStates[playerId] = ready;
    updateReadyButton(playerId, ready);
    refreshStartButton();
});

function refreshStartButton() {
    startButton.style.visibility =
        (readyStates[1] && readyStates[2]) ? "visible" : "hidden";
}

function startBgPicking() {
    console.log(player1.name, player2.name);
    socket.emit("startGame", room);
}
socket.on("gameStart", () => {
    window.location.href = "/backgroundLoc";
});
