// immediately‑invoked to avoid polluting globals
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
        // only player 1 kicks off the startGame roulette
        if (myId === 1) {
            socket.emit("startGame", room);
            console.log("[BG] player1 emitted startGame");
        }
    });

    // 2) MiniFighter helper (same as fighter‑selection)
    class MiniFighter {
        constructor(canvas, src, scale, framesMax, offset) {
            this.canvas = canvas; this.ctx = canvas.getContext("2d");
            this.img = new Image(); this.loaded = false;
            this.img.onload = () => (this.loaded = true);
            if (src) this.img.src = src;
            this.scale = scale || 1;
            this.framesMax = framesMax || 1;
            this.current = 0; this.elapsed = 0; this.hold = 4;
            this.offset = offset || { x: 0, y: 0 };
            this.flipped = false;
        }
        draw() {
            if (!this.loaded) return;
            const fw = this.img.width / this.framesMax;
            const dw = fw * this.scale;
            const dh = this.img.height * this.scale;
            const dx = -this.offset.x, dy = -this.offset.y;
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
            if (++this.elapsed % this.hold === 0) {
                this.current = (this.current + 1) % this.framesMax;
            }
        }
    }

    // 3) Set up fighter canvases
    const c1 = document.getElementById("player1canvas");
    c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
    const player1 = new MiniFighter(c1, null);

    const c2 = document.getElementById("player2canvas");
    c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
    const player2 = new MiniFighter(c2, null);
    player2.flipped = true;

    // 4) Small helper fetch
    async function fetchJSON(path) {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
        return res.json();
    }

    // 5) Load which fighters each side picked
    async function setFighters() {
        const fighters = await fetchJSON("/fighters");
        const name1 = sessionStorage.getItem("player1");
        const name2 = sessionStorage.getItem("player2");

        const f1 = fighters.find(f => f.Name === name1);
        player1.img.src = f1.Idle;
        player1.scale = f1.BackgroundSelectionScale;
        player1.framesMax = f1.IdleFrames;
        player1.offset = {
            x: f1.BackgroundSelectionOffsetX,
            y: f1.BackgroundSelectionOffsetY
        };
        player1.hold = 8;

        const f2 = fighters.find(f => f.Name === name2);
        player2.img.src = f2.Idle;
        player2.scale = f2.BackgroundSelectionScale;
        player2.framesMax = f2.IdleFrames;
        player2.offset = {
            x: f2.BackgroundSelectionOffsetX,
            y: f2.BackgroundSelectionOffsetY
        };
        player2.hold = 8;
    }

    // 6) Fetch & render the background thumbnails
    async function setBackgroundThumbnails() {
        const bgs = await fetchJSON("/backgrounds");
        const container = document.getElementById("backgrounds");
        bgs.forEach(bg => {
            const img = document.createElement("img");
            img.src = bg.BackgroundImage;
            img.alt = bg.Name;
            img.className = "backgroundImage";
            container.appendChild(img);
        });
    }

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

        const clearThumbs = () => thumbs.forEach(i => i.classList.remove("temp-brightness"));
        const clearCanvas = () => ctx.clearRect(0, 0, W, H);

        // every 100 ms flash a random thumb & draw it into the canvas
        const roulette = setInterval(() => {
            clearThumbs();
            clearCanvas();
            const rand = thumbs[Math.floor(Math.random() * thumbs.length)];
            rand.classList.add("temp-brightness");
            ctx.drawImage(rand, 0, 0, W, H);
        }, 100);

        // after 5 s, stop, lock in the real pick, then go to /fight
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
    Promise.all([setFighters(), setBackgroundThumbnails()])
        .catch(console.error);

})();
