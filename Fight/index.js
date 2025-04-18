// 1) connect & join
const socket = io();
const room = sessionStorage.getItem('room');
const clientId = localStorage.getItem('clientId');
socket.emit('joinRoom', { room, clientId });


// 3) track which animation we’re in
let currentSpriteName = 'idle';

// Grab two canvases: one offscreen for camera‐transform, one onscreen
const offscreenCanvas = document.createElement("canvas");
const offscreenCtx = offscreenCanvas.getContext("2d");
offscreenCanvas.width = 1280;
offscreenCanvas.height = 720;

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 1280;
canvas.height = 720;

// Movement constants
const MOVE_SPEED = canvas.width / 275;
const JUMP_VELOCITY = canvas.height / 45;

// 2) decide who is “me” vs “them”
const myPlayerId = Number(sessionStorage.getItem('myPlayerId')); // 1 or 2
const player1 = new Fighter({
    position: { x: canvas.width * 0.25, y: canvas.height / 5 },
    velocity: { x: 0, y: 0 }
});
const player2 = new Fighter({
    position: { x: canvas.width * 0.75, y: canvas.height / 5 },
    velocity: { x: 0, y: 0 }
});
const localFighter = myPlayerId === 1 ? player1 : player2;
const remoteFighter = myPlayerId === 1 ? player2 : player1;

let groundLvl, backgroundSprite;

// Setup video element
const videoSource = document.getElementById("videoSource");
const videoElement = document.getElementById("borderBackground");

// Players & health bars
const player1HealthBar = document.querySelector("#player1Health");
const player2HealthBar = document.querySelector("#player2Health");

// Gravity
const gravity = 0.5;

// Create Fighter instances (from classes.js)

// Keyboard state
const keys = {
    s: false, a: false, d: false,
    ArrowLeft: false, ArrowRight: false, ArrowDown: false
};
// whenever the other client sends us their state...
socket.on('remoteState', data => {
    // position & velocity
    remoteFighter.position.x = data.x;
    remoteFighter.position.y = data.y;
    remoteFighter.velocity.x = data.vx;
    remoteFighter.velocity.y = data.vy;
    remoteFighter.flip = data.flip;

    // animation frame
    if (data.sprite && remoteFighter.sprites[data.sprite]) {
        remoteFighter.image = remoteFighter.sprites[data.sprite].image;
        remoteFighter.framesMax = remoteFighter.sprites[data.sprite].framesMax;
        remoteFighter.framesCurrent = data.frame;
    }

    // if they’re attacking, trigger it locally
    if (data.attack) {
        remoteFighter.attackStyle = data.attackStyle;
        remoteFighter.attackBox = remoteFighter.sprites[data.sprite].attackBox;
        remoteFighter.attack();
    }

    // sync health bar
    remoteFighter.health = data.health;
    const bar = myPlayerId === 1
        ? document.querySelector('#player2Health')
        : document.querySelector('#player1Health');
    bar.style.width = Math.max(data.health, 0) + '%';
});

// whenever the other client sends us their state...
socket.on('remoteState', data => {
    // position & velocity
    remoteFighter.position.x = data.x;
    remoteFighter.position.y = data.y;
    remoteFighter.velocity.x = data.vx;
    remoteFighter.velocity.y = data.vy;
    remoteFighter.flip = data.flip;

    // animation frame
    if (data.sprite && remoteFighter.sprites[data.sprite]) {
        remoteFighter.image = remoteFighter.sprites[data.sprite].image;
        remoteFighter.framesMax = remoteFighter.sprites[data.sprite].framesMax;
        remoteFighter.framesCurrent = data.frame;
    }

    // if they’re attacking, trigger it locally
    if (data.attack) {
        remoteFighter.attackStyle = data.attackStyle;
        remoteFighter.attackBox = remoteFighter.sprites[data.sprite].attackBox;
        remoteFighter.attack();
    }

    // sync health bar
    remoteFighter.health = data.health;
    const bar = myPlayerId === 1
        ? document.querySelector('#player2Health')
        : document.querySelector('#player1Health');
    bar.style.width = Math.max(data.health, 0) + '%';
});


// Main setup
async function setUpGame() {
    // 1) pick up the chosen background name
    const bgName = sessionStorage.getItem("background");
    const { imageSrc, groundLevel, borderBackground } = await setBackground(bgName);

    // 2) apply video only if it exists
    if (borderBackground) {
        videoSource.src = borderBackground;
        videoElement.load();
    } else {
        // no video: clear out any old src to prevent "null" attempts
        videoSource.removeAttribute('src');
    }

    groundLvl = groundLevel;
    backgroundSprite = new Sprite({
        position: { x: 0, y: 0 },
        imageSrc,
        width: canvas.width,
        height: canvas.height
    });

    // 3) initialize fighters (loads their sprites & computes damage)
    await initializeGame();
    decreaseTimer();
    // 4) start the render loop
    requestAnimationFrame(animate);
}

// Pull it all together
setUpGame();

// ===== Helper: Camera Zoom & Pan =====
function calculateCamera() {
    const margin = 100,
        maxZoom = 1.8,
        worldW = canvas.width;

    const leftP = Math.min(player1.position.x, player2.position.x),
        rightP = Math.max(
            player1.position.x + player1.width,
            player2.position.x + player2.width
        );

    const needW = (rightP - leftP) + margin * 2;
    let scale = canvas.width / needW;
    scale = Math.min(Math.max(scale, 1), maxZoom);

    let centerX = (leftP + rightP) / 2;
    const halfView = (canvas.width / scale) / 2;
    centerX = Math.min(
        worldW - halfView,
        Math.max(halfView, centerX)
    );

    return { scale, cameraX: centerX };
}

// Resolve horizontal movement & sprites
function updateHorizontalMovement(pl, other, left, right, lk, rk) {
    let canL = left && pl.position.x > 0;
    let canR = right && pl.position.x + pl.width < canvas.width;

    // simple “no overlap” when both on ground
    if (
        pl.hitbox.position.y + pl.hitbox.height > other.hitbox.position.y
    ) {
        if (pl.flip) canL = canL && (pl.hitbox.position.x > other.hitbox.position.x + other.hitbox.width);
        else canR = canR && (pl.hitbox.position.x + pl.hitbox.width < other.hitbox.position.x);
    }

    if (canL) {
        pl.velocity.x = -MOVE_SPEED;
        pl.lastKey = lk;
        pl.switchSprite("run");
    } else if (canR) {
        pl.velocity.x = MOVE_SPEED;
        pl.lastKey = rk;
        pl.switchSprite("run");
    } else {
        pl.switchSprite("idle");
    }
}

// Update jump/fall sprite
function updateVerticalSprite(pl) {
    if (pl.velocity.y < 0) pl.switchSprite("jump");
    else if (pl.velocity.y > 0) pl.switchSprite("fall");
}

// Attack collision / health
function processAttackCollision(attacker, defender, barEl) {
    if (rectangularCollision(attacker, defender)) {
        if (attacker.isAttacking && attacker.framesCurrent >= attacker.attackFrames / 2) {
            defender.takeHit(attacker.damage);
            attacker.isAttacking = false;
            barEl.style.width = Math.max(defender.health, 0) + "%";
        }
    }
    if (attacker.isAttacking && attacker.framesCurrent >= attacker.attackFrames / 2) {
        attacker.isAttacking = false;
    }
}

function sendMyState() {
    const sf = localFighter;
    socket.emit('state', {
        room,
        x: sf.position.x,
        y: sf.position.y,
        vx: sf.velocity.x,
        vy: sf.velocity.y,
        flip: sf.flip,
        sprite: sf.currentSpriteName,
        frame: sf.framesCurrent,
        attack: sf.isAttacking,
        attackStyle: sf.attackStyle,
        health: sf.health
    });
}

// ==== Gamepad poll helper ====
function pollGamepadInputs() {
    const gamepads = navigator.getGamepads();
    const threshold = 0.2;

    function makeState(gp) {
        if (!gp) return {};
        return {
            left: gp.axes[0] < -threshold || gp.buttons[14].pressed,
            right: gp.axes[0] > threshold || gp.buttons[15].pressed,
            jump: gp.axes[1] < -threshold || gp.buttons[12].pressed,
            attack: false,
            block: gp.buttons[0].pressed || gp.buttons[1].pressed ||
                gp.buttons[2].pressed || gp.buttons[3].pressed
        };
    }

    const gp1 = gamepads[0] ? makeState(gamepads[0]) : {};
    const gp2 = gamepads[1] ? makeState(gamepads[1]) : {};

    // map shoulder buttons → concrete attack flags, etc.
    const mapping = [
        { b: 4, style: "style1", sprite: "attack1" },
        { b: 5, style: "style2", sprite: "attack2" },
        { b: 7, style: "style3", sprite: "attack3" },
        { b: 6, style: "style4", sprite: "attack4" }
    ];

    if (gamepads[0]) {
        for (let m of mapping) {
            if (gamepads[0].buttons[m.b].pressed) {
                gp1.attack = true;
                player1.attackStyle = m.style;
                player1.attackBox = player1.sprites[m.sprite].attackBox;
                player1.attackFrames = player1.sprites[m.sprite].framesMax;
                break;
            }
        }
        player1.isBlocking = gp1.block;
    }
    if (gamepads[1]) {
        for (let m of mapping) {
            if (gamepads[1].buttons[m.b].pressed) {
                gp2.attack = true;
                player2.attackStyle = m.style;
                player2.attackBox = player2.sprites[m.sprite].attackBox;
                player2.attackFrames = player2.sprites[m.sprite].framesMax;
                break;
            }
        }
        player2.isBlocking = gp2.block;
    }

    return { gp1State: gp1, gp2State: gp2 };
}

// Main render loop
function animate() {
    requestAnimationFrame(animate);

    const { scale, cameraX } = calculateCamera();

    offscreenCtx.fillStyle = "black";
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    offscreenCtx.save();
    offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height);
    offscreenCtx.scale(scale, scale);
    offscreenCtx.translate(-cameraX, -canvas.height);

    // background + fighters
    backgroundSprite.draw(offscreenCtx);
    player1.update(offscreenCtx);
    player2.update(offscreenCtx);

    // face‐off
    if (player1.position.x < player2.position.x) {
        player1.flip = false; player2.flip = true;
    } else {
        player1.flip = true; player2.flip = false;
    }
    player1.velocity.x = 0;
    player2.velocity.x = 0;

    // ground collisions
    function resolveVerticalCollisionBetweenFighters(f, other) {
        if (f.velocity.y <= 0) return;
        const hit = f.hitbox, oh = other.hitbox;
        if (
            hit.position.x < oh.position.x + oh.width &&
            hit.position.x + hit.width > oh.position.x &&
            hit.position.y + hit.height > oh.position.y &&
            hit.position.y < oh.position.y
        ) {
            // land on top
            hit.position.y = oh.position.y - hit.height;
            f.velocity.y = 0;

            // slip off slightly
            const fCenter = hit.position.x + hit.width / 2;
            const oCenter = oh.position.x + oh.width / 2;
            f.velocity.x = fCenter < oCenter ? -SLIP_SPEED : SLIP_SPEED;
        }
    }

    // gamepad polling if you want...
    const { gp1State, gp2State } = pollGamepadInputs();

    // P1
    updateHorizontalMovement(
        player1, player2,
        keys.a || gp1State.left,
        keys.d || gp1State.right,
        "a", "d"
    );
    if ((gp1State.jump || false) && player1.position.y + player1.height >= groundLvl) {
        player1.velocity.y = -JUMP_VELOCITY;
    }
    updateVerticalSprite(player1);
    if (gp1State.attack && !prevGp1Attack) player1.attack();
    prevGp1Attack = gp1State.attack;

    // P2
    updateHorizontalMovement(
        player2, player1,
        keys.ArrowLeft || gp2State.left,
        keys.ArrowRight || gp2State.right,
        "ArrowLeft", "ArrowRight"
    );
    if ((gp2State.jump || false) && player2.position.y + player2.height >= groundLvl) {
        player2.velocity.y = -JUMP_VELOCITY;
    }
    updateVerticalSprite(player2);
    if (gp2State.attack && !prevGp2Attack) player2.attack();
    prevGp2Attack = gp2State.attack;

    // attacks
    processAttackCollision(player1, player2, player2HealthBar);
    processAttackCollision(player2, player1, player1HealthBar);

    // win condition
    if (player1.health <= 0 || player2.health <= 0) {
        clearTimeout(timerID);
        determineWinner(player1, player2, timerID);
    }

    offscreenCtx.restore();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
    sendMyState();
}

// Initialize fighters & damage, then fire off the loop
async function initializeGame() {
    await Promise.all([
        setFighterData(player1, false, sessionStorage.getItem("player1")),
        setFighterData(player2, true, sessionStorage.getItem("player2"))
    ]);
    // compute their damage values
    await Promise.all([
        determineDamage(player1),
        determineDamage(player2)
    ]);
    // kick off the timer and first frame
    animate();
}

// === Keyboard Listeners ===
window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

window.addEventListener("keyup", (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});
