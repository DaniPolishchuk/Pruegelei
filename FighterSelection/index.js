// FighterSelection/index.js

// — fetch the fighter list from your REST API
async function getFighters() {
    try {
        const res = await fetch('/fighters');
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    } catch (err) {
        console.error('Error fetching fighters:', err);
        return [];
    }
}

// — MiniFighter class for the little canvases
class MiniFighter {
    constructor(canvas, idle, scale, idleFrames, offset) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = new Image();
        this.loaded = false;
        this.image.onload = () => (this.loaded = true);
        this.image.onerror = () => (this.loaded = false);
        this.setImage(idle);

        this.scale = scale || 0;
        this.framesMax = idleFrames || 0;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 4;
        this.offset = offset || { x: 0, y: 0 };
        this.flipped = false;
        this.name = null;
    }

    setImage(src) {
        if (src) {
            this.loaded = false;
            this.image.src = src;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (!this.loaded) return;
        const fw = this.image.width / this.framesMax;
        const dw = fw * this.scale;
        const dh = this.image.height * this.scale;
        const dx = -this.offset.x;
        const dy = -this.offset.y;

        if (this.flipped) {
            this.ctx.save();
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(
                this.image,
                this.framesCurrent * fw, 0, fw, this.image.height,
                -(dx + dw), dy, dw, dh
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                this.image,
                this.framesCurrent * fw, 0, fw, this.image.height,
                dx, dy, dw, dh
            );
        }
    }

    update() {
        this.draw();
        this.framesElapsed++;
        if (this.framesElapsed % this.framesHold === 0) {
            this.framesCurrent = (this.framesCurrent + 1) % this.framesMax;
        }
    }
}

// — grab UI elements & set up canvases
const p1c = document.getElementById('player1canvas');
p1c.width = p1c.offsetWidth;
p1c.height = p1c.offsetHeight;
const player1 = new MiniFighter(p1c, null);

const p2c = document.getElementById('player2canvas');
p2c.width = p2c.offsetWidth;
p2c.height = p2c.offsetHeight;
const player2 = new MiniFighter(p2c, null);
player2.flipped = true;

const allFightersDiv = document.getElementById('availableFighters');
const readyBtn1 = document.getElementById('readyButton1');
const readyBtn2 = document.getElementById('readyButton2');
const startBtn = document.getElementById('startButton');

function animate() {
    requestAnimationFrame(animate);
    player1.update();
    player2.update();
    allFighters.forEach(f => f.update());
}

function getReady(btn) {
    btn.pressed = !btn.pressed;
    btn.style.backgroundColor = btn.pressed ? 'orange' : 'black';
    btn.style.color = btn.pressed ? 'black' : 'orange';
    startBtn.style.visibility = (readyBtn1.pressed && readyBtn2.pressed) ? 'visible' : 'hidden';
}

// — build the fighter‑buttons grid
const allFighters = [];
async function fillDivWithFighters() {
    const fighters = await getFighters();
    fighters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'fighter';
        const cvs = document.createElement('canvas');
        cvs.className = 'miniCanvas';
        btn.appendChild(cvs);
        allFightersDiv.appendChild(btn);

        cvs.width = btn.offsetWidth;
        cvs.height = btn.offsetHeight;

        const mini = new MiniFighter(
            cvs,
            f.Idle,
            f.SelectionMenuScale,
            f.IdleFrames,
            { x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY }
        );
        allFighters.push(mini);

        btn.onclick = () => {
            if (!readyBtn1.pressed) {
                player1.setImage(f.Idle);
                player1.scale = f.SelectedScale;
                player1.framesMax = f.IdleFrames;
                player1.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                player1.name = f.Name;
                readyBtn1.pressed = true;
                readyBtn1.style.visibility = 'visible';
            } else if (!readyBtn2.pressed) {
                player2.setImage(f.Idle);
                player2.scale = f.SelectedScale;
                player2.framesMax = f.IdleFrames;
                player2.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                player2.name = f.Name;
                readyBtn2.pressed = true;
                readyBtn2.style.visibility = 'visible';
            }
            getReady(readyBtn1);
            getReady(readyBtn2);
        };
    });
}

// — wiring up the ready/start buttons
readyBtn1.onclick = () => getReady(readyBtn1);
readyBtn2.onclick = () => getReady(readyBtn2);
startBtn.onclick = () => {
    sessionStorage.setItem('player1', player1.name);
    sessionStorage.setItem('player2', player2.name);
    window.location.href = '/background';
};

// — kick things off
document.addEventListener('DOMContentLoaded', async () => {
    await fillDivWithFighters();
    animate();
});
