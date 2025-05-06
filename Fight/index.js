import {Sprite, Fighter} from "./js/classes.js";
import {
    decreaseTimer,
    determineDamage,
    determineWinner,
    rectangularCollision,
    setBackground,
    setFighterData
} from "./js/utils.js";
import {
    JUMP_VELOCITY,
    offscreenCtx,
    offscreenCanvas,
    canvas,
    ctx,
    gravity,
    calculateCamera,
    updateHorizontalMovement,
    updateVerticalSprite,
    resolveVerticalCollisionBetweenFighters} from "../localGameMode/Fight/fight.js";

const keys = { a: false, d: false, w: false, s: false, '1':false, '2': false, '3': false, '4': false, ArrowLeft: false, ArrowRight: false, ArrowUp: false };
const remoteKeys = { a: false, d: false, w: false, s: false, '1': false, '2': false, '3': false, '4': false, ArrowLeft: false, ArrowRight: false, ArrowUp: false };

const DEBUG = true;          // ◀ flip to false when you’re done
function dlog(...args) { if (DEBUG) console.log(...args); }

// 1) connect & join
const socket = io();
const room = sessionStorage.getItem('room');
const clientId = localStorage.getItem('clientId');
socket.emit('joinRoom', { roomName: room, clientId });


// 3) track which animation we’re in
let currentSpriteName = 'idle';

offscreenCanvas.width = 1280;
offscreenCanvas.height = 720;

canvas.width = 1280;
canvas.height = 720;

// 2) decide who is “me” vs “them”
const myPlayerId = Number(sessionStorage.getItem('playerId')); // 1 or 2
const player1 = new Fighter({
    position: { x: canvas.width * 0.25, y: canvas.height / 5 },
    velocity: { x: 0, y: 0 },
    canvas
});
const player2 = new Fighter({
    position: { x: canvas.width * 0.75, y: canvas.height / 5 },
    velocity: { x: 0, y: 0 },
    canvas
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

// Create Fighter instances (from classes.js)
window.addEventListener("keydown", e => {
    if (e.repeat) return;

    if (e.key === 's') {
        keys.s = true;
        localFighter.isBlocking = true;
        sendMyState();
    }

    // mark key pressed
    if (keys.hasOwnProperty(e.key)) keys[e.key] = true;
    socket.emit("playerInput", { roomName: room, key: e.key, pressed: true });

    if (['1', '2', '3', '4'].includes(e.key))
        startAttack(e.key);
});


window.addEventListener('keyup', e => {
    if (e.key === 's') {
        keys.s = false;
        localFighter.isBlocking = false;
        sendMyState();
    }
    if (keys[e.key] === true) {
        keys[e.key] = false;
        socket.emit('playerInput', { roomName: room, key: e.key, pressed: false });
    }
});

// when your buddy presses/releases, update `remoteKeys`
socket.on('remoteInput', ({ key, pressed }) => {
    if (remoteKeys.hasOwnProperty(key)) remoteKeys[key] = pressed;
});

socket.on("confirmedHit", ({ defenderId, damage }) => {
    const defender =
        defenderId === myPlayerId ? localFighter : remoteFighter;

    defender.takeHit(damage);          // plays take‑hit / death frames
    const bar = defenderId === 1 ? player1HealthBar : player2HealthBar;
    bar.style.width = Math.max(defender.health, 0) + "%";
});

// socket.on('remoteAttack', () => {
//     console.log('[REMOTE ATTACK] Received from server');
//     const style = remoteFighter.attackStyle || "style1";
//     switch (style) {
//         case "style1": remoteFighter.switchSprite("attack1"); break;
//         case "style2": remoteFighter.switchSprite("attack2"); break;
//         case "style3": remoteFighter.switchSprite("attack3"); break;
//         case "style4": remoteFighter.switchSprite("attack4"); break;
//     }
//     remoteFighter.isAttacking = true;


//     // Force a collision check immediately (so remote fighter can deal damage)
//     if (myPlayerId === 2) {
//         processAttackCollision(remoteFighter, localFighter, player1HealthBar);
//     } else {
//         processAttackCollision(remoteFighter, localFighter, player2HealthBar);
//     }
// });



// whenever the other client sends us their state...
socket.on("remoteState", data => {
    // 1) position & flip
    remoteFighter.position.x = data.x;
    remoteFighter.position.y = data.y;
    remoteFighter.flip = data.flip;

    // 2) if we're mid‑attack, ignore later idle/run updates
    if (remoteFighter.isAttacking && !data.attack) return;

    // 3) normal sprite copy (safe)
    if (data.sprite && remoteFighter.sprites?.[data.sprite]) {
        const spr = remoteFighter.sprites[data.sprite];
        remoteFighter.image = spr.image;
        remoteFighter.framesMax = spr.framesMax;
        remoteFighter.framesCurrent = data.frame;
    }

    // 4) attack handling (code from section 1)
    if (data.attack) {
        if (!remoteFighter.isAttacking) {
            const style = data.attackStyle || "style1";
            const spriteKey = `attack${style.slice(-1)}`;
            if (remoteFighter.sprites?.[spriteKey]) {
                remoteFighter.switchSprite(spriteKey);
                remoteFighter.attackBox   = remoteFighter.sprites[spriteKey].attackBox;
                remoteFighter.attackFrames = remoteFighter.sprites[spriteKey].framesMax;
                remoteFighter.isAttacking  = true;
            }
        }
    }


    // sync health bar
    remoteFighter.health = data.health;
    remoteFighter.isBlocking = !!data.block;
    const bar = myPlayerId === 1
        ? document.querySelector('#player2Health')
        : document.querySelector('#player1Health');
    bar.style.width = Math.max(data.health, 0) + '%';
});

function startAttack(styleIdx) {
    const spriteKey = `attack${styleIdx}`;
    if(!localFighter.sprites[spriteKey]?.imageSrc) return;
    localFighter.attackStyle = `style${styleIdx}`;
    localFighter.switchSprite(spriteKey);
    localFighter.attackBox = localFighter.sprites[spriteKey].attackBox;
    localFighter.attackFrames = localFighter.sprites[spriteKey].framesMax;
    localFighter.isAttacking = true;
    localFighter.hitLanded = false;
    dlog(`[LOCAL] key ${styleIdx} → ${spriteKey}`);
    sendMyState();
}


function remotePressed(leftKey, rightKey) {
    return {
        left: remoteKeys[leftKey] || remoteKeys.ArrowLeft,
        right: remoteKeys[rightKey] || remoteKeys.ArrowRight,
        jump: remoteKeys.w || remoteKeys.ArrowUp
    };
}

// Main setup
async function setUpGame() {
    // 1) pick up the chosen background name
    const bgName = sessionStorage.getItem("background");
    const { imageSrc, groundLevel, borderBackground } = await setBackground(bgName);

    // 2) apply video only if it exists
    // Apply video only if we have a URL
    if (typeof borderBackground === "string" && borderBackground) {
        videoSource.src = borderBackground;
    } else {
        videoSource.removeAttribute("src");
    }

    // Tell the <video> element to reload its sources
    videoElement.load();

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

// Attack collision / health
function processAttackCollision(attacker, defender, barEl) {
    if (attacker.isAttacking && !attacker.hitLanded && attacker.framesCurrent >= attacker.attackFrames / 2) {
        const collision = rectangularCollision(attacker, defender);

        dlog(
            `[CHECK] ${attacker === localFighter ? "LOCAL" : "REMOTE"} vs ` +
            `${defender === localFighter ? "LOCAL" : "REMOTE"}`,
            " style=", attacker.attackStyle,
            " frame=", attacker.framesCurrent
        );

        if (collision && attacker === localFighter && attacker.isAttacking) {
            socket.emit('hit', {
                roomName: room,
                attackerId: myPlayerId,
                defenderId: myPlayerId === 1 ? 2 : 1,
                damage: attacker.damage
            });
            attacker.hitLanded = true;
        }
    }
}


function sendMyState() {
    const sf = localFighter;
    //console.log('→ sendMyState', sf.position.x.toFixed(1), sf.position.y.toFixed(1));
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
        block: sf.isBlocking,
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
    const local = myPlayerId === 1 ? player1 : player2;
    const other = myPlayerId === 1 ? player2 : player1;
    const localMap = keys;
    const otherMap = remoteKeys;

    localFighter.isBlocking = keys.s || localFighter.isBlocking;   // keyboard + gamepad
    remoteFighter.isBlocking = remoteKeys.s || remoteFighter.isBlocking;

    // 1) Camera & clear
    const { scale, cameraX } = calculateCamera();
    offscreenCtx.fillStyle = "black";
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // 2) Apply camera transforms
    offscreenCtx.save();
    offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height);
    offscreenCtx.scale(scale, scale);
    offscreenCtx.translate(-cameraX, -canvas.height);

    // 3) Draw background & both fighters
    backgroundSprite.draw(offscreenCtx);
    player1.update(offscreenCtx, groundLvl, gravity);
    player2.update(offscreenCtx, groundLvl, gravity);

    // 4) Face‑off and zero out old horizontal velocities
    if (player1.position.x < player2.position.x) {
        player1.flip = false;
        player2.flip = true;
    } else {
        player1.flip = true;
        player2.flip = false;
    }
    player1.velocity.x = 0;
    player2.velocity.x = 0;

    // 5) Poll gamepad
    const { gp1State, gp2State } = pollGamepadInputs();

    // —— LOCAL PLAYER INPUT —— 
    updateHorizontalMovement(
        local, other,
        localMap.a, localMap.d,   // left/right pressed?
        "a", "d"                   // which keys they map to
    );
    if (localMap.w && local.position.y + local.height >= groundLvl) {
        local.velocity.y = -JUMP_VELOCITY;  // jump
    }
    updateVerticalSprite(local);          // switch to jump/fall sprite

    

    // 7) ATTACK COLLISIONS
    processAttackCollision(player1, player2, player2HealthBar);
    processAttackCollision(player2, player1, player1HealthBar);

    // 8) WIN CONDITION
    if (player1.health <= 0 || player2.health <= 0) {
        determineWinner(player1, player2);
    }

    // 9) Un‑do camera, draw to screen, and sync up your state
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
    //animate();
}