// BackgroundSelection/index.js

// --- MiniFighter class (same as in FighterSelection) ---
class MiniFighter {
    constructor(canvas, src, scale, framesMax, offset) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.img = new Image();
        this.loaded = false;
        this.img.onload = () => (this.loaded = true);

        this.scale = scale || 1;
        this.framesMax = framesMax || 1;
        this.current = 0;
        this.elapsed = 0;
        this.hold = 4;
        this.offset = offset || { x: 0, y: 0 };
        this.flipped = false;

        if (src) this.img.src = src;
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
        this.elapsed++;
        if (this.elapsed % this.hold === 0) {
            this.current = (this.current + 1) % this.framesMax;
        }
    }
}

// --- Canvas setup for the two fighters ---
const p1c = document.getElementById("player1canvas");
p1c.width = p1c.offsetWidth;
p1c.height = p1c.offsetHeight;
const player1 = new MiniFighter(p1c, null);

const p2c = document.getElementById("player2canvas");
p2c.width = p2c.offsetWidth;
p2c.height = p2c.offsetHeight;
const player2 = new MiniFighter(p2c, null);
player2.flipped = true;

// --- Helpers to fetch fighters & backgrounds ---
async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return await res.json();
}

async function setFighters() {
    const name1 = sessionStorage.getItem("player1");
    const name2 = sessionStorage.getItem("player2");
    const fighters = await fetchJSON("/fighters");

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

// --- Populate thumbnails ---
const bgsContainer = document.getElementById("backgrounds");
async function setBackgroundThumbnails() {
    const bgs = await fetchJSON("/backgrounds");
    for (const bg of bgs) {
        const img = document.createElement("img");
        img.src = bg.BackgroundImage;
        img.alt = bg.Name;
        img.className = "backgroundImage";
        bgsContainer.appendChild(img);
    }
}

// --- Animation loop for mini‑fighters ---
function animate() {
    requestAnimationFrame(animate);
    player1.update();
    player2.update();
}
animate();

// --- WebSocket to receive the one gameStart with chosen background ---
const socket = new WebSocket(
    (location.protocol === "https:" ? "wss" : "ws") +
    "://" + location.host
);
socket.binaryType = "blob";

socket.addEventListener("open", () => {
    const room = sessionStorage.getItem("room");
    const clientId = localStorage.getItem("clientId");
    socket.send(JSON.stringify({ type: "joinRoom", room, clientId }));
});

socket.addEventListener("message", async ev => {
    let text = ev.data instanceof Blob
        ? await ev.data.text()
        : ev.data;
    let msg;
    try { msg = JSON.parse(text); }
    catch { return; }

    if (msg.type === "gameStart") {
        const chosen = msg.background;
        // highlight & flash the chosen thumbnail
        const thumb = Array.from(bgsContainer.querySelectorAll("img"))
            .find(i => i.alt === chosen);
        if (!thumb) {
            console.error("Background not found:", chosen);
            return;
        }
        thumb.classList.add("temp-brightness");

        // show it in the big preview
        document.getElementById("pickedBackground").innerHTML =
            `<img src="${thumb.src}" id="pickedBackgroundImage" alt="${chosen}">`;

        // after a short delay, go to /fight
        setTimeout(() => {
            window.location.href = "/fight";
        }, 500);
    }
});

// --- Initialization ---
(async function init() {
    await setFighters();
    await setBackgroundThumbnails();
})();
