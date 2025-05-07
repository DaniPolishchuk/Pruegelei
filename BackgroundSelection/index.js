import {setBackgrounds, setFighters} from "../Fight/js/utils.js";
import {MiniFighter} from "../Fight/js/classes.js";

(async function () {
    // 1) Reconnect & re‑join your room
    const socket = io();
    const room = sessionStorage.getItem("room");
    const clientId = localStorage.getItem("clientId");
    const myId = Number(sessionStorage.getItem("playerId"));
    if (!room || !clientId || !myId) {
        alert("Missing room/clientId/playerId—please re‑join from the lobby");
        throw new Error("bg: missing session data");
    }
    socket.on("connect", () => {
        socket.emit("restore", clientId);
        socket.emit("joinRoom", { roomName: room, clientId });
        // only player1 kicks off the startGame roulette
        if (myId === 1) {
            socket.emit("startGame", room);
            console.log("[BG] player1 emitted startGame");
        }
    });

    // 3) Set up fighter canvases
    const c1 = document.getElementById("player1canvas");
    c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
    const player1 = new MiniFighter(c1, null);

    const c2 = document.getElementById("player2canvas");
    c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
    const player2 = new MiniFighter(c2, null);
    player2.flipped = true;
    const bgs = document.getElementById("backgrounds");

    // 7) Always animate the fighters
    (function animateFighters() {
        requestAnimationFrame(animateFighters);
        player1.update();
        player2.update();
    })();

    // 8) On gameStart — do a 5s roulette in both the canvas AND the thumbnail highlights
    socket.on("gameStart", ({ background }) => {
        const thumbs = Array.from(document.querySelectorAll("#backgrounds img"));
        const displayCanvas = document.getElementById("pickedBackgroundCanvas");
        const ctx = displayCanvas.getContext("2d");
        const W = displayCanvas.width, H = displayCanvas.height;
        sessionStorage.setItem("background", background);

        const clearThumbs = () => thumbs.forEach(i => i.classList.remove("temp-brightness"));
        const clearCanvas = () => ctx.clearRect(0, 0, W, H);

        // every 100ms flash a random thumb & draw it into the canvas
        const roulette = setInterval(() => {
            clearThumbs();
            clearCanvas();
            const rand = thumbs[Math.floor(Math.random() * thumbs.length)];
            rand.classList.add("temp-brightness");
            ctx.drawImage(rand, 0, 0, W, H);
        }, 100);

        // after 5s, stop, lock in the real pick, then go to /fight
        setTimeout(() => {
            clearInterval(roulette);
            clearThumbs();
            clearCanvas();
            const chosenImg = thumbs.find(i => i.alt === background);
            if (!chosenImg) return console.error("Picked background not found:", background);
            chosenImg.classList.add("temp-brightness");
            ctx.drawImage(chosenImg, 0, 0, W, H);
            setTimeout(() => window.location.href = "/fight", 500);
        }, 5000);
    });

    // 9) Preload fighters & thumbnails together
    Promise.all([setFighters(player1, player2), setBackgrounds(bgs)])
        .catch(console.error);

})();