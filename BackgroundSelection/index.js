import { player1, player2 } from "../FighterSelection/index.js";
import {getFighters} from "../Fight/js/utils.js";
import {setBackgrounds, setFighters} from "../localGameMode/BackgroundSelection/backgroundSelection.js";

const socket = io();
const room = sessionStorage.getItem("room");
const clientId = localStorage.getItem("clientId");
const myId = Number(sessionStorage.getItem("playerId"));

if (!room || !clientId || !myId) {
    alert("Missing room/clientId/playerId—please re‑join from the lobby");
    throw new Error("Missing session data");
}

socket.on("connect", () => {
    socket.emit("restore", clientId);
    socket.emit("joinRoom", { roomName: room, clientId });

    // only player1 kicks off roulette
    if (myId === 1) {
        socket.emit("startGame", room);
        console.log("[BG] player1 emitted startGame");
    }
});

const pickedCanvas = document.getElementById("pickedBackgroundCanvas");
const ctx = pickedCanvas.getContext("2d");
pickedCanvas.width = pickedCanvas.offsetWidth;
pickedCanvas.height = pickedCanvas.offsetHeight;

function animate() {
    requestAnimationFrame(animate);
    player1.update();
    player2.update();
}

socket.on("gameStart", ({background}) => {
    const thumbs = Array.from(document.querySelectorAll("#backgrounds img"));
    const W = pickedCanvas.width;
    const H = pickedCanvas.height;

    const clear = () => {
        ctx.clearRect(0, 0, W, H);
        thumbs.forEach(img => img.classList.remove("temp-brightness"));
    };

    const intervalId = setInterval(() => {
        clear();
        const random = thumbs[Math.floor(Math.random() * thumbs.length)];
        random.classList.add("temp-brightness");
        ctx.drawImage(random, 0, 0, W, H);
    }, 100);

    setTimeout(() => {
        clearInterval(intervalId);
        clear();
        const chosen = thumbs.find(i => i.alt === background);
        if (!chosen) return console.error("Background not found:", background);
        chosen.classList.add("temp-brightness");
        ctx.drawImage(chosen, 0, 0, W, H);
        sessionStorage.setItem("background", background);
        setTimeout(() => window.location.href = "/fightLoc", 500);
    }, 5000);
});

(async function init() {
    await setFighters();
    await setBackgrounds();
    animate();
})();
