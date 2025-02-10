// ===== Canvas Setup =====
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ===== Global Constants =====
const gravity = 0.5;

// ===== Background =====
const background = new Sprite({
    position: {x: 0, y: 0},
    imageSrc: "Backgrounds/Background1.png"
});

// ===== Players =====
const player1 = new Fighter({
    position: {
        x: canvas.width * 0.25,
        y: canvas.height / 5,
    },
    velocity: {x: 0, y: 0}
});

const player2 = new Fighter({
    position: {
        x: canvas.width * 0.75,
        y: canvas.height / 5,
    },
    velocity: {x: 0, y: 0}
});

// ===== Keyboard Input Object =====
const keys = {
    a: {pressed: false},
    d: {pressed: false},
    ArrowLeft: {pressed: false},
    ArrowRight: {pressed: false}
};

decreaseTimer(); // assuming this function is defined elsewhere

// ===== Main Animation Loop =====
function animate() {
    window.requestAnimationFrame(animate);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update background and players
    background.update();
    player1.update();
    player2.update();

    // Reset horizontal velocities every frame
    player1.velocity.x = 0;
    player2.velocity.x = 0;

    // ===== Poll Gamepad States =====
    const {gp1State, gp2State} = pollGamepadInputs();

    // ===== Player 1 Movement (Keyboard + Gamepad #1) =====
    const p1Left = keys.a.pressed || gp1State.left;
    const p1Right = keys.d.pressed || gp1State.right;

    if (p1Left && player1.position.x > 0) {
        player1.velocity.x = -canvas.width / 275;
        player1.lastKey = "a";
        player1.switchSprite("run");
    } else if (p1Right && player1.position.x + player1.width < canvas.width) {
        player1.velocity.x = canvas.width / 275;
        player1.lastKey = "d";
        player1.switchSprite("run");
    } else {
        player1.switchSprite("idle");
    }

    // Vertical movement for player 1: gamepad jump (keyboard jump is handled on keydown)
    if (gp1State.jump && player1.position.y + player1.height >= canvas.height / 1.147) {
        player1.velocity.y = -canvas.height / 45;
    }
    if (player1.velocity.y < 0) {
        player1.switchSprite("jump");
    } else if (player1.velocity.y > 0) {
        player1.switchSprite("fall");
    }
    if (gp1State.attack) {
        player1.attack();
    }

    // ===== Player 2 Movement (Keyboard + Gamepad #2) =====
    const p2Left = keys.ArrowLeft.pressed || gp2State.left;
    const p2Right = keys.ArrowRight.pressed || gp2State.right;

    if (p2Left && player2.position.x > 0) {
        player2.velocity.x = -canvas.width / 275;
        player2.lastKey = "ArrowLeft";
        player2.switchSprite("run");
    } else if (p2Right && player2.position.x + player2.width < canvas.width) {
        player2.velocity.x = canvas.width / 275;
        player2.lastKey = "ArrowRight";
        player2.switchSprite("run");
    } else {
        player2.switchSprite("idle");
    }

    if (gp2State.jump && player2.position.y + player2.height >= canvas.height / 1.147) {
        player2.velocity.y = -canvas.height / 45;
    }
    if (player2.velocity.y < 0) {
        player2.switchSprite("jump");
    } else if (player2.velocity.y > 0) {
        player2.switchSprite("fall");
    }
    if (gp2State.attack) {
        player2.attack();
    }

    // ===== Collision & Health Management =====
    if (rectangularCollusion(player1, player2, true) && player1.isAttacking && player1.framesCurrent >= player1.attackFrames / 2) {
        player1.isAttacking = false;
        player2.health -= 10;
        document.querySelector("#player2health").style.width = player2.health + "%";
    }

    if (player1.isAttacking && player1.framesCurrent >= player1.attackFrames / 2) {
        player1.isAttacking = false;
    }

    if (rectangularCollusion(player2, player1, false) && player2.isAttacking && player2.framesCurrent >= player2.attackFrames / 2) {
        player2.isAttacking = false;
        player1.health -= 10;
        document.querySelector("#player1health").style.width = player1.health + "%";
    }

    if (player2.isAttacking && player2.framesCurrent >= player2.attackFrames / 2) {
        player2.isAttacking = false;
    }

    if (player2.health <= 0 || player1.health <= 0) {
        determineWinner(player1, player2, timerID);
    }
}

async function initializeGame() {
    await setFighterData(player1, false, "Fantasy Warrior");
    await setFighterData(player2, true, "Evil Wizard 2");

    setTimeout(() => {
        animate();
    }, 1); // Delay to ensure images are loaded
}

initializeGame();

// ===== Keyboard Event Listeners =====
window.addEventListener("keydown", (event) => {
    switch (event.key) {
        // --- Player 1 ---
        case "d":
            keys.d.pressed = true;
            player1.lastKey = "d";
            break;
        case "a":
            keys.a.pressed = true;
            player1.lastKey = "a";
            break;
        case "w":
            if (player1.position.y + player1.height >= canvas.height / 1.187) {
                player1.velocity.y = -canvas.height / 45;
            }
            break;
        case "1":
            player1.attackStyle = "style1";
            player1.attackBox = player1.sprites.attack1.attackBox;
            player1.attackFrames = player1.sprites.attack1.framesMax;
            player1.attack();
            break;
        case "2":
            player1.attackStyle = "style2";
            player1.attackBox = player1.sprites.attack2.attackBox;
            player1.attackFrames = player1.sprites.attack2.framesMax;
            player1.attack();
            break;
        case "3":
            player1.attackStyle = "style3";
            player1.attackBox = player1.sprites.attack3.attackBox;
            player1.attackFrames = player1.sprites.attack3.framesMax;
            player1.attack();
            break;
        case "4":
            player1.attackStyle = "style4";
            player1.attackBox = player1.sprites.attack4.attackBox;
            player1.attackFrames = player1.sprites.attack4.framesMax;
            player1.attack();
            break;

        // --- Player 2 ---
        case "ArrowLeft":
            keys.ArrowLeft.pressed = true;
            player2.lastKey = "ArrowLeft";
            break;
        case "ArrowRight":
            keys.ArrowRight.pressed = true;
            player2.lastKey = "ArrowRight";
            break;
        case "ArrowUp":
            if (player2.position.y + player2.height >= canvas.height / 1.187) {
                player2.velocity.y = -canvas.height / 45;
            }
            break;
        case "0":
            player2.attackStyle = "style1";
            player2.attackBox = player2.sprites.attack1.attackBox;
            player2.attackFrames = player2.sprites.attack1.framesMax;
            player2.attack();
            break;
        case "9":
            player2.attackStyle = "style2";
            player2.attackBox = player2.sprites.attack2.attackBox;
            player2.attackFrames = player2.sprites.attack2.framesMax;
            player2.attack();
            break;
        case "8":
            player2.attackStyle = "style3";
            player2.attackBox = player2.sprites.attack3.attackBox;
            player2.attackFrames = player2.sprites.attack3.framesMax;
            player2.attack();
            break;
        case "7":
            player2.attackStyle = "style4";
            player2.attackBox = player2.sprites.attack4.attackBox;
            player2.attackFrames = player2.sprites.attack4.framesMax;
            player2.attack();
            break;
    }
});

window.addEventListener("keyup", (event) => {
    switch (event.key) {
        case "d":
            keys.d.pressed = false;
            break;
        case "a":
            keys.a.pressed = false;
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

    const gp1State = {
        left: false,
        right: false,
        jump: false,
        attack: false,
        attackStyle: null
    };
    const gp2State = {
        left: false,
        right: false,
        jump: false,
        attack: false,
        attackStyle: null
    };

    // gamepad[0] for player 1
    if (gamepads[0]) {
        const threshold = 0.2; // avoid stick noise
        const gp1 = gamepads[0];
        gp1State.left = gp1.axes[0] < -threshold;
        gp1State.right = gp1.axes[0] > threshold;
        gp1State.jump = gp1.axes[1] < -threshold;
        if (gp1.buttons[4].pressed) {
            gp1State.attack = true;
            player1.attackStyle = "style1";
        }
        if (gp1.buttons[5].pressed) {
            gp1State.attack = true;
            player1.attackStyle = "style2";
        }
        if (gp1.buttons[7].pressed) {
            gp1State.attack = true;
            player1.attackStyle = "style3";
        }
        if (gp1.buttons[6].pressed) {
            gp1State.attack = true;
            player1.attackStyle = "style4";
        }
    }
    // gamepad[1] for player 2
    if (gamepads[1]) {
        const threshold = 0.2;
        const gp2 = gamepads[1];
        gp2State.left = gp2.axes[0] < -threshold;
        gp2State.right = gp2.axes[0] > threshold;
        gp2State.jump = gp2.axes[1] < -threshold;
        if (gp2.buttons[4].pressed) {
            gp2State.attack = true;
            player2.attackStyle = "style1";
        }
        if (gp2.buttons[5].pressed) {
            gp2State.attack = true;
            player2.attackStyle = "style2";
        }
        if (gp2.buttons[7].pressed) {
            gp2State.attack = true;
            player2.attackStyle = "style3";
        }
    }
    return {gp1State, gp2State};
}
