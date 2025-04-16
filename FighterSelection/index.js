// 1) Fetch fighters
async function getFighters() {
    try {
        const res = await fetch('/fighters');
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    } catch (e) {
        console.error('Error fetching fighters:', e);
        return [];
    }
}

// 2) MiniFighter
class MiniFighter {
    constructor(canvas, src, scale, framesMax, offset) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.img = new Image();
        this.loaded = false;
        this.img.onload = () => this.loaded = true;
        this.scale = scale || 1;
        this.framesMax = framesMax || 1;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 4;
        this.offset = offset || { x: 0, y: 0 };
        this.flipped = false;
        if (src) this.setImage(src);
    }
    setImage(src) {
        this.loaded = false;
        this.img.src = src;
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
                this.framesCurrent * fw, 0, fw, this.img.height,
                -(dx + dw), dy, dw, dh
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                this.img,
                this.framesCurrent * fw, 0, fw, this.img.height,
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

// 3) Setup canvases & UI
const c1 = document.getElementById('player1canvas');
c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
const player1 = new MiniFighter(c1);

const c2 = document.getElementById('player2canvas');
c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
const player2 = new MiniFighter(c2);
player2.flipped = true;

const all = [], container = document.getElementById('availableFighters');
const rb1 = document.getElementById('readyButton1');
const rb2 = document.getElementById('readyButton2');
const sb = document.getElementById('startButton');

function animate() {
    requestAnimationFrame(animate);
    player1.update(); player2.update();
    all.forEach(m => m.update());
}

// 4) Populate fighter grid
async function fillFighters() {
    const fighters = await getFighters();
    fighters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = 'fighter';
        const cvs = document.createElement('canvas');
        cvs.className = 'miniCanvas';
        btn.appendChild(cvs);
        container.appendChild(btn);
        cvs.width = btn.offsetWidth; cvs.height = btn.offsetHeight;

        const mini = new MiniFighter(
            cvs,
            f.Idle,
            f.SelectionMenuScale,
            f.IdleFrames,
            { x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY }
        );
        all.push(mini);

        btn.onclick = () => {
            if (!rb1.pressed) {
                player1.setImage(f.Idle);
                player1.scale = f.SelectedScale;
                player1.framesMax = f.IdleFrames;
                player1.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                rb1.pressed = true; rb1.style.visibility = 'visible';
            } else if (!rb2.pressed) {
                player2.setImage(f.Idle);
                player2.scale = f.SelectedScale;
                player2.framesMax = f.IdleFrames;
                player2.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                rb2.pressed = true; rb2.style.visibility = 'visible';
            }
            if (rb1.pressed && rb2.pressed) sb.style.visibility = 'visible';
        };
    });
}

// 5) Buttons
rb1.onclick = () => { rb1.pressed = !rb1.pressed; };
rb2.onclick = () => { rb2.pressed = !rb2.pressed; };
sb.onclick = () => {
    sessionStorage.setItem('player1', player1.name);
    sessionStorage.setItem('player2', player2.name);
    window.location.href = '/background';
};

// 6) Init
document.addEventListener('DOMContentLoaded', async () => {
    await fillFighters();
    animate();
});
