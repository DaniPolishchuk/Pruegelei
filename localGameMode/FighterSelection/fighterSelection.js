import { getFighters } from "../../Fight/js/utils.js";

export class MiniFighter {
    constructor(canvas, idle, scale, idleFrames, offset) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext("2d");
        this.image = new Image();
        this.image.onload = () => this.loaded = true;
        this.image.onerror = () => this.loaded = false;
        this.loaded = false;
        this.setImage(idle);
        this.scale = scale || 0;
        this.framesMax = idleFrames || 0;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 4;
        this.offset = offset || {x: 0, y: 0};
        this.flipped = false;
        this.name = null;
    }

    setImage(idle) {
        if (idle) {
            this.loaded = false; // Reset until new image loads
            this.image.src = idle;
        } else {
            this.image.src = ""; // Clear src if idle is null
            this.loaded = false;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.loaded && this.image.src) {
            const frameWidth = this.image.width / this.framesMax;
            const drawWidth = frameWidth * this.scale;
            const drawHeight = this.image.height * this.scale;
            const drawX = -this.offset.x;
            const drawY = -this.offset.y;
            if (this.flipped) {
                this.ctx.save();
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    this.image,
                    this.framesCurrent * frameWidth,
                    0,
                    frameWidth,
                    this.image.height,
                    -(drawX + drawWidth),
                    drawY,
                    drawWidth,
                    drawHeight
                );
                this.ctx.restore();
            } else {
                this.ctx.drawImage(
                    this.image,
                    this.framesCurrent * frameWidth,
                    0,
                    frameWidth,
                    this.image.height,
                    drawX,
                    drawY,
                    drawWidth,
                    drawHeight
                );
            }
        }
    }

    update() {
        this.draw();
        this.framesElapsed++;
        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.framesMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }

    }
}

export const player1canvas = document.getElementById("player1canvas");
player1canvas.width = player1canvas.offsetWidth;
player1canvas.height = player1canvas.offsetHeight;
export const player1 = new MiniFighter(player1canvas, null);

export const player2canvas = document.getElementById("player2canvas");
player2canvas.width = player2canvas.offsetWidth;
player2canvas.height = player2canvas.offsetHeight;
export const player2 = new MiniFighter(document.getElementById("player2canvas"), null);
player2.flipped = true;

const allFighters = [];

function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
    allFighters.forEach((fighter) => {
        fighter.update();
    });
}

async function fillDivWithFighters() {
    getFighters().then(fighters => {
        for (const fighter of fighters) {
            let newButton = document.createElement("button");
            newButton.className = "fighter";
            let newCanvas = document.createElement("canvas");
            newCanvas.className = "miniCanvas";
            newButton.appendChild(newCanvas);
            let parent = document.getElementById("availableFighters");
            parent.appendChild(newButton);
            newCanvas.width = newButton.offsetWidth;
            newCanvas.height = newButton.offsetHeight;
            allFighters.push(new MiniFighter(newCanvas, fighter.Idle, fighter.SelectionMenuScale, fighter.IdleFrames, {
                x: fighter.SelectionMenuOffsetX,
                y: fighter.SelectionMenuOffsetY,
            }));
            newButton.addEventListener("click", () => selectFighter(fighter));
        }
    });
}

function selectFighter(fighter) {
    if (!readyButton1.pressed) {
        player1.setImage(fighter.Idle);
        player1.scale = fighter.SelectedScale;
        player1.framesMax = fighter.IdleFrames;
        player1.offset = {
            x: fighter.SelectedOffsetX,
            y: fighter.SelectedOffsetY
        };
        player1.framesCurrent = 0;
        player1.name = fighter.Name;

        readyButton1.style.visibility = "visible";
    } else if (!readyButton2.pressed) {
        player2.setImage(fighter.Idle);
        player2.scale = fighter.SelectedScale;
        player2.framesMax = fighter.IdleFrames;
        player2.offset = {
            x: fighter.SelectedOffsetX,
            y: fighter.SelectedOffsetY
        };
        player2.framesCurrent = 0;
        player2.name = fighter.Name;

        readyButton2.style.visibility = "visible";
    }
}

export const readyButton1 = document.getElementById("readyButton1");
export const readyButton2 = document.getElementById("readyButton2");
export const startButton = document.getElementById("startButton");
if (readyButton1 && readyButton2 && startButton) {
    readyButton1.addEventListener("click", () => getReady(readyButton1));
    readyButton2.addEventListener("click", () => getReady(readyButton2));
    startButton.addEventListener("click", startBgPicking)
}

function getReady(button) {
    if (!button.pressed) {
        button.style.backgroundColor = "orange";
        button.style.color = "black";
        button.pressed = true;
    } else {
        button.style.backgroundColor = "black";
        button.style.color = "orange";
        button.pressed = false;
    }

    if (readyButton1.pressed && readyButton2.pressed) {
        startButton.style.visibility = "visible";
    } else {
        startButton.style.visibility = "hidden";
    }
}

function startBgPicking() {
    sessionStorage.setItem("player1", player1.name)
    sessionStorage.setItem("player2", player2.name)
    window.location.href = "/backgroundLoc"
}

document.addEventListener("DOMContentLoaded", () => {
    fillDivWithFighters();
});
animate();
