// ==========================
// Imports
// ==========================
import {
  setBackgrounds,
  setFighters,
  setSong,
  player1canvas,
  player2canvas,
  videoSource,
  videoElement,
  bgs,
  audio,
} from "../utils.js";
import { MiniFighter } from "../classes.js";

// ==========================
// Session & Socket Setup
// ==========================
// eslint-disable-next-line no-undef
const socket = io();
const room = sessionStorage.getItem("room");
const clientId = localStorage.getItem("clientId");
const myId = Number(sessionStorage.getItem("playerId"));

// ==========================
// Background Video
// ==========================
videoSource.src = "/Assets/Backgrounds/Default/video.bin";
videoElement.load();

// ==========================
// Background audio setup
// ==========================
setSong(audio, window.sessionStorage.getItem("song"));

// ==========================
// Session Validation
// ==========================
if (!room || !clientId || !myId) {
  alert("Missing room/clientId/playerId—please re‑join from the lobby");
  throw new Error("bg: missing session data");
}

// ==========================
// Socket Join & Game Start Trigger
// ==========================
socket.on("connect", () => {
  socket.emit("restore", clientId);
  socket.emit("joinRoom", { roomName: room, clientId });
  socket.emit("startGame", room);
});

// ==========================
// Player Preview Setup
// ==========================
const player1 = new MiniFighter(player1canvas, null);
const player2 = new MiniFighter(player2canvas, null);
player2.flipped = true;

// ==========================
// Fighter Animation Loop
// ==========================
function animate() {
  player1.update();
  player2.update();
  requestAnimationFrame(animate);
}

// ==========================
// Background Selection Logic
// ==========================
socket.on("gameStart", ({ background }) => {
  const thumbs = Array.from(document.querySelectorAll("#backgrounds img"));
  const displayCanvas = document.getElementById("pickedBackgroundCanvas");
  const ctx = displayCanvas.getContext("2d");
  const W = displayCanvas.width,
    H = displayCanvas.height;

  sessionStorage.setItem("background", background);

  const clearThumbs = () =>
    thumbs.forEach((img) => img.classList.remove("temp-brightness"));
  const clearCanvas = () => ctx.clearRect(0, 0, W, H);

  const roulette = setInterval(() => {
    clearThumbs();
    clearCanvas();
    const rand = thumbs[Math.floor(Math.random() * thumbs.length)];
    try {
      rand.classList.add("temp-brightness");
      // eslint-disable-next-line no-unused-vars
    } catch (err) {
      window.location.reload();
    }
    ctx.drawImage(rand, 0, 0, W, H);
  }, 100);

  setTimeout(() => {
    clearInterval(roulette);
    clearThumbs();
    clearCanvas();

    const chosenImg = thumbs.find((i) => i.alt === background);
    if (!chosenImg)
      return console.error("Picked background not found:", background);

    chosenImg.classList.add("temp-brightness");
    ctx.drawImage(chosenImg, 0, 0, W, H);

    setTimeout(() => {
      window.location.href = "/fight";
    }, 500);
  }, 5000);
});

// ==========================
// Initialization
// ==========================
async function init() {
  await setFighters(player1, player2);
  await setBackgrounds(bgs);
  animate();
}

init();
