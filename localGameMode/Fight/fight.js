import {Sprite, Fighter } from "../../Fight/js/classes.js";
import {
    decreaseTimer,
    determineDamage,
    determineWinner,
    rectangularCollision,
    setBackground,
    setFighterData
} from "../../Fight/js/utils.js";

export const offscreenCanvas = document.createElement("canvas");
export const offscreenCtx = offscreenCanvas.getContext("2d");

offscreenCanvas.width = 1280;
offscreenCanvas.height = 720;

export const canvas = document.querySelector("canvas");
export const ctx = canvas.getContext("2d");
canvas.width = 1280;
canvas.height = 720;
// ===== Precompute Constants =====
export const MOVE_SPEED = canvas.width / 275;
export const JUMP_VELOCITY = canvas.height / 45;

let groundLvl, background;

async function setUpGame() {

    const { imageSrc, groundLevel, borderBackground } = await setBackground(sessionStorage.getItem("background"));

    // Setup video
    const videoSource = document.getElementById('videoSource');
    const videoElement = document.getElementById('borderBackground');

    videoSource.src = borderBackground;
    videoElement.load();

    groundLvl = groundLevel;
    background = new Sprite({
        position: { x: 0, y: 0},
        imageSrc: imageSrc,
        width: canvas.width,
        height: canvas.height
    });

    await initializeGame(); // wait until fighters are ready
    requestAnimationFrame(animate); // only now start animating
}

setUpGame();

// ===== Cache DOM Elements =====
const player1HealthBar = document.querySelector("#player1Health");
const player2HealthBar = document.querySelector("#player2Health");

// ===== Global Constants =====
export const gravity = 0.5;

// ===== Players =====
const player1 = new Fighter({
    position: {
        x: canvas.width * 0.25,
        y: canvas.height / 5,
    },
    velocity: { x: 0, y: 0 },
    canvas
});

const player2 = new Fighter({
    position: {
        x: canvas.width * 0.75,
        y: canvas.height / 5,
    },
    velocity: { x: 0, y: 0 },
    canvas
});

// ===== Keyboard Input Object =====
export const keys = {
    s: {pressed: false},
    a: {pressed: false},
    d: {pressed: false},
    ArrowLeft: {pressed: false},
    ArrowRight: {pressed: false},
    ArrowDown: {pressed: false},
}


decreaseTimer(player1, player2);

// ===== Helper Functions =====

export function calculateCamera() {
    const margin = 100;
    const maxZoom = 1.8;
    const worldLeft = 0;
    const worldRight = canvas.width;

    const playerLeft = Math.min(player1.position.x, player2.position.x);
    const playerRight = Math.max(
        player1.position.x + player1.width,
        player2.position.x + player2.width
    );

    const requiredViewWidth = (playerRight - playerLeft) + 2 * margin;
    let candidateScale = canvas.width / requiredViewWidth;

    let effectiveScale = Math.max(candidateScale, 1);
    effectiveScale = effectiveScale > maxZoom ? maxZoom : effectiveScale;
    let desiredCenterX = (playerLeft + playerRight) / 2;
    const halfViewWidth = (canvas.width / effectiveScale) / 2;
    desiredCenterX = Math.max(worldLeft + halfViewWidth, Math.min(desiredCenterX, worldRight - halfViewWidth));

    return { scale: effectiveScale, cameraX: desiredCenterX};
}

// Update horizontal movement (common to both players)
export function updateHorizontalMovement(player, player2, leftPressed, rightPressed, leftKey, rightKey) {
    let canMoveLeft = leftPressed && player.position.x > 0;
    let canMoveRight = rightPressed && player.position.x + player.width < canvas.width;

    if(player.hitbox.position.y + player.hitbox.height > player2.hitbox.position.y) {
        if (player.flip) {
            canMoveLeft = canMoveLeft && player.hitbox.position.x > player2.hitbox.position.x + player2.hitbox.width;
        } else {
            canMoveRight = canMoveRight && player.hitbox.position.x + player.hitbox.width < player2.hitbox.position.x;
        }
    }

    if (canMoveLeft) {
        player.velocity.x = -MOVE_SPEED;
        player.lastKey = leftKey;
        player.switchSprite("run");
    } else if (canMoveRight) {
        player.velocity.x = MOVE_SPEED;
        player.lastKey = rightKey;
        player.switchSprite("run");
    } else {
        player.switchSprite("idle");
    }
}

const SLIP_SPEED = 1; // Passe diesen Wert nach Bedarf an

export function resolveVerticalCollisionBetweenFighters(fighter, otherFighter) {
    // Nur prüfen, wenn der Fighter nach unten fällt
    if (fighter.velocity.y > 0) {
        // Prüfe, ob sich die beiden horizontal überschneiden
        if (
            fighter.hitbox.position.x < otherFighter.hitbox.position.x + otherFighter.hitbox.width &&
            fighter.hitbox.position.x + fighter.hitbox.width > otherFighter.hitbox.position.x
        ) {
            // Prüfe, ob der untere Rand des fallenden Fighters den oberen Bereich des anderen erreicht
            if (
                fighter.hitbox.position.y + fighter.hitbox.height > otherFighter.hitbox.position.y &&
                fighter.hitbox.position.y < otherFighter.hitbox.position.y
            ) {
                // Setze den Fighter so, dass er genau auf dem anderen Fighter landet
                fighter.hitbox.position.y = otherFighter.hitbox.position.y - fighter.hitbox.height;
                fighter.velocity.y = 0;

                // Berechne die Mittelpunkte beider Fighter
                const fighterCenter = fighter.hitbox.position.x + fighter.hitbox.width / 2;
                const otherCenter = otherFighter.hitbox.position.x + otherFighter.hitbox.width / 2;

                // Wenn der Fighter links vom Zentrum des anderen ist, rutsche nach links, sonst nach rechts
                if (fighterCenter < otherCenter) {
                    fighter.velocity.x = -SLIP_SPEED;
                } else if (fighterCenter > otherCenter) {
                    fighter.velocity.x = SLIP_SPEED;
                }
            }
        }
    }
}

// Update vertical movement sprites (jump/fall)
export function updateVerticalSprite(player) {
    if (player.velocity.y < 0) {
        player.switchSprite("jump");
    } else if (player.velocity.y > 0) {
        player.switchSprite("fall");
    }
}

// Process collision and health updates
function processAttackCollision(attacker, defender, defenderHealthBar) {
    if (rectangularCollision(attacker, defender)) {
        if (attacker.isAttacking && attacker.framesCurrent >= attacker.attackFrames / 2) {
            defender.takeHit(attacker.damage);
            attacker.isAttacking = false;
            defenderHealthBar.style.width = Math.max(defender.health, 0) + "%";
        }
    }
    // Reset attack flag if necessary
    if (attacker.isAttacking && attacker.framesCurrent >= attacker.attackFrames / 2) {
        attacker.isAttacking = false;
    }
}

let prevGp1Attack = false;
let prevGp2Attack = false;

// ===== Main Animation Loop =====
function animate() {
    window.requestAnimationFrame(animate);

    const { scale, cameraX} = calculateCamera();

    offscreenCtx.fillStyle = "black";
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    offscreenCtx.save();

    offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height);

    offscreenCtx.scale(scale, scale);

    offscreenCtx.translate(-cameraX, -canvas.height);

    if (background) {
        background.draw(offscreenCtx);
    }

    player1.update(offscreenCtx, groundLvl, gravity);
    player2.update(offscreenCtx, groundLvl, gravity);

    if (player1.position.x < player2.position.x) {
        player1.flip = false;
        player2.flip = true;
    } else {
        player1.flip = true;
        player2.flip = false;
    }
    player1.velocity.x = 0;
    player2.velocity.x = 0;
    resolveVerticalCollisionBetweenFighters(player1, player2);
    resolveVerticalCollisionBetweenFighters(player2, player1);

    const { gp1State, gp2State } = pollGamepadInputs();

    updateHorizontalMovement(
        player1,
        player2,
        keys.a.pressed || gp1State.left,
        keys.d.pressed || gp1State.right,
        "a",
        "d"
    );

    if (gp1State.jump && player1.position.y + player1.height >= groundLvl) {
        player1.velocity.y = -JUMP_VELOCITY;
    }
    updateVerticalSprite(player1);
    if (gp1State.attack && !prevGp1Attack) {
        player1.attack();
    }
    prevGp1Attack = gp1State.attack;

    updateHorizontalMovement(
        player2,
        player1,
        keys.ArrowLeft.pressed || gp2State.left,
        keys.ArrowRight.pressed || gp2State.right,
        "ArrowLeft",
        "ArrowRight"
    );
    if (gp2State.jump && player2.position.y + player2.height >= groundLvl) {
        player2.velocity.y = -JUMP_VELOCITY;
    }
    updateVerticalSprite(player2);
    if (gp2State.attack && !prevGp2Attack) {
        player2.attack();
    }
    prevGp2Attack = gp2State.attack;

    processAttackCollision(player1, player2, player2HealthBar);
    processAttackCollision(player2, player1, player1HealthBar);

    if (player2.health <= 0 || player1.health <= 0) {
        determineWinner(player1, player2);
    }

    offscreenCtx.restore();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
}


// ===== Game Initialization =====
async function initializeGame() {
    // Wait for fighter data to load for both players
    await Promise.all([
        setFighterData(player1, false, sessionStorage.getItem("player1")),
        setFighterData(player2, true, sessionStorage.getItem("player2")),
        determineDamage(player1),
        determineDamage(player2)
    ]);
    // Start the animation loop
    animate();
}

// ===== Keyboard Event Listeners =====
window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    // --- Player 1 Controls ---
    if (!player1.dead) {
        switch (event.key) {
            case "s":
                keys.s.pressed = true;
                player1.lastKey = "s";
                player1.isBlocking = true;
                break;
            case "d":
                keys.d.pressed = true;
                player1.lastKey = "d";
                break;
            case "a":
                keys.a.pressed = true;
                player1.lastKey = "a";
                break;
            case "w":
                if (player1.position.y + player1.height >= groundLvl) {
                    player1.velocity.y = -JUMP_VELOCITY;
                }
                break;
            case "1":
                player1.attackStyle = "style1";
                player1.attackBox = player1.sprites.attack1.attackBox;
                player1.attackFrames = player1.sprites.attack1.framesMax;
                determineDamage(player1);
                player1.attack();
                break;
            case "2":
                player1.attackStyle = "style2";
                player1.attackBox = player1.sprites.attack2.attackBox;
                player1.attackFrames = player1.sprites.attack2.framesMax;
                determineDamage(player1);
                player1.attack();
                break;
            case "3":
                player1.attackStyle = "style3";
                player1.attackBox = player1.sprites.attack3.attackBox;
                player1.attackFrames = player1.sprites.attack3.framesMax;
                determineDamage(player1);
                player1.attack();
                break;
            case "4":
                player1.attackStyle = "style4";
                player1.attackBox = player1.sprites.attack4.attackBox;
                player1.attackFrames = player1.sprites.attack4.framesMax;
                determineDamage(player1);
                player1.attack();
                break;
        }
    }
    // --- Player 2 Controls ---
    if (!player2.dead) {
        switch (event.key) {
            case "ArrowDown":
                keys.ArrowDown.pressed = true;
                player2.lastKey = "ArrowDown";
                player2.isBlocking = true;
                break;
            case "ArrowLeft":
                keys.ArrowLeft.pressed = true;
                player2.lastKey = "ArrowLeft";
                break;
            case "ArrowRight":
                keys.ArrowRight.pressed = true;
                player2.lastKey = "ArrowRight";
                break;
            case "ArrowUp":
                if (player2.position.y + player2.height >= groundLvl) {
                    player2.velocity.y = -JUMP_VELOCITY;
                }
                break;
            case "0":
                player2.attackStyle = "style1";
                player2.attackBox = player2.sprites.attack1.attackBox;
                player2.attackFrames = player2.sprites.attack1.framesMax;
                determineDamage(player2);
                player2.attack();
                break;
            case "9":
                player2.attackStyle = "style2";
                player2.attackBox = player2.sprites.attack2.attackBox;
                player2.attackFrames = player2.sprites.attack2.framesMax;
                determineDamage(player2);
                player2.attack()
                break;
            case "8":
                player2.attackStyle = "style3";
                player2.attackBox = player2.sprites.attack3.attackBox;
                player2.attackFrames = player2.sprites.attack3.framesMax;
                determineDamage(player2);
                player2.attack();
                break;
            case "7":
                player2.attackStyle = "style4";
                player2.attackBox = player2.sprites.attack4.attackBox;
                player2.attackFrames = player2.sprites.attack4.framesMax;
                determineDamage(player2)
                player2.attack();
                break;
        }
    }
});

window.addEventListener("keyup", (event) => {
    switch (event.key) {
        case "s":
            keys.s.pressed = false;
            player1.isBlocking = false;
            break;
        case "d":
            keys.d.pressed = false;
            break;
        case "a":
            keys.a.pressed = false;
            break;
        case "ArrowDown":
            keys.ArrowDown.pressed = false;
            player2.isBlocking = false;
            break;
        case "ArrowLeft":
            keys.ArrowLeft.pressed = false;
            break;
        case "ArrowRight":
            keys.ArrowRight.pressed = false;
            break;
    }
});

// ===== Gamepad Polling Function =====
function pollGamepadInputs() {
    const gamepads = navigator.getGamepads();
    const threshold = 0.2; // to avoid stick noise

    // Helper to create a basic gamepad state
    const createGamepadState = (gp) => ({
        left: gp.axes[0] < -threshold || gp.buttons[14].pressed,
        right: gp.axes[0] > threshold || gp.buttons[15].pressed,
        jump: gp.axes[1] < -threshold || gp.buttons[12].pressed,
        attack: false,
        attackStyle: null,
        block: gp.buttons[0].pressed || gp.buttons[1].pressed ||
            gp.buttons[2].pressed || gp.buttons[3].pressed
    });

    // Player 1
    const gp1State = !player1.dead && gamepads[0] ? createGamepadState(gamepads[0]) : {};
    // Player 2
    const gp2State = !player2.dead && gamepads[1] ? createGamepadState(gamepads[1]) : {};

    // Map button indices to attack styles for both gamepads
    const attackMapping = [
        { button: 4, style: "style1", sprite: "attack1" },
        { button: 5, style: "style2", sprite: "attack2" },
        { button: 7, style: "style3", sprite: "attack3" },
        { button: 6, style: "style4", sprite: "attack4" }
    ];

    // Process gamepad 1 buttons
    if (gp1State && gamepads[0]) {
        const gp1 = gamepads[0];
        for (const mapping of attackMapping) {
            if (gp1.buttons[mapping.button].pressed) {
                gp1State.attack = true;
                player1.attackBox = player1.sprites[mapping.sprite].attackBox;
                player1.attackFrames = player1.sprites[mapping.sprite].framesMax;
                player1.attackStyle = mapping.style;
                break;
            }
        }
        player1.isBlocking = gp1State.block;
    }
    // Process gamepad 2 buttons
    if (gp2State && gamepads[1]) {
        const gp2 = gamepads[1];
        for (const mapping of attackMapping) {
            if (gp2.buttons[mapping.button].pressed) {
                gp2State.attack = true;
                player2.attackBox = player2.sprites[mapping.sprite].attackBox;
                player2.attackFrames = player2.sprites[mapping.sprite].framesMax;
                player2.attackStyle = mapping.style;
                break;
            }
        }
        player2.isBlocking = gp2State.block;
    }

    return { gp1State, gp2State };
}