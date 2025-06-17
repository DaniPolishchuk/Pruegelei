// ==========================
// Imports
// ==========================
import { Sprite, Fighter } from "../classes.js";
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  determineDamage,
  determineWinner,
  rectangularCollision,
  setBackground,
  setFighterData,
  calculateCamera,
  updateHorizontalMovement,
  updateVerticalSprite,
  resolveVerticalCollisionBetweenFighters,
  pollGamepadInputs,
  setSong,
  offscreenCanvas,
  offscreenCtx,
  canvas,
  ctx,
  JUMP_VELOCITY,
  videoSource,
  videoElement,
  gravity,
  player1HealthBar,
  player2HealthBar,
  audio,
  yesBtn,
  reselectBtn,
  noBtn,
  header,
  modal,
} from "../utils.js";
import {
  actionPlayer2,
  decisionMaking,
  loadQTableFromURL,
} from "../AI/aiUtils.js";

// ==========================
// Input Tracking
// ==========================
const keys = {
  s: { pressed: false },
  a: { pressed: false },
  d: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowDown: { pressed: false },
};

let groundLvl, background;
let rematchRequested = false;
let isPaused = false;
const ai = sessionStorage.getItem("ai") === "true";

// ==========================
// Rematch Modal (local)
// ==========================
function showRematchModal() {
  setTimeout(function () {
    [yesBtn, reselectBtn, noBtn].forEach((btn) => (btn.disabled = false));
    header.textContent = "Rematch?";

    yesBtn.onclick = () => {
      header.textContent = "Reloading…";
      window.location.reload();
    };
    reselectBtn.onclick = () => {
      header.textContent = "Reselecting…";
      window.history.go(-2);
    };
    noBtn.onclick = () => {
      header.textContent = "Leaving…";
      window.location.href = "/";
    };

    modal.style.display = "flex";
  }, 3000);
}

// ==========================
// Player Setup
// ==========================
const player1 = new Fighter({
  position: { x: canvas.width * 0.25, y: canvas.height / 5 },
  velocity: { x: 0, y: 0 },
  canvas,
});

const player2 = new Fighter({
  position: { x: canvas.width * 0.75, y: canvas.height / 5 },
  velocity: { x: 0, y: 0 },
  canvas,
});

// ==========================
// Game Initialization
// ==========================
async function setUpGame() {
  if (ai) {
    qTable = await loadQTableFromURL("../AI/qtable_20250616_113118.bin");
  }
  const { imageSrc, groundLevel, borderBackground } = await setBackground(
    sessionStorage.getItem("background"),
  );

  videoSource.src = borderBackground;
  videoElement.load();

  setSong(audio, sessionStorage.getItem("song"));

  groundLvl = groundLevel;

  background = new Sprite({
    position: { x: 0, y: 0 },
    imageSrc,
    width: canvas.width,
    height: canvas.height,
  });

  await initializeGame();
  const initial = parseInt(document.getElementById("timer").textContent, 10);
  startTimer(
    initial,
    (v) => (document.getElementById("timer").textContent = v),
    () => {
      determineWinner(player1, player2);
      if (!rematchRequested) {
        rematchRequested = true;
        showRematchModal();
      }
    },
  );
  requestAnimationFrame(animate);
}

async function initializeGame() {
  await Promise.all([
    setFighterData(player1, false, sessionStorage.getItem("player1")),
    setFighterData(player2, true, sessionStorage.getItem("player2")),
  ]);

  await Promise.all([determineDamage(player1), determineDamage(player2)]);
}

setUpGame();

// ==========================
// Collision & Damage Handling
// ==========================
function processAttackCollision(attacker, defender, defenderHealthBar) {
  if (
    attacker.isAttacking &&
    !attacker.hitLanded &&
    attacker.framesCurrent >= attacker.attackFrames / 2 &&
    rectangularCollision(attacker, defender)
  ) {
    defender.takeHit(attacker.damage);
    attacker.hitLanded = true;
    defenderHealthBar.style.width = Math.max(defender.health, 0) + "%";
  }

  // Reset attack state when animation completes
  if (
    attacker.isAttacking &&
    attacker.framesCurrent >= attacker.attackFrames - 1
  ) {
    attacker.isAttacking = false;
    attacker.hitLanded = false;
  }
}

// ==========================
// Animation Loop
// ==========================
let prevGp1Attack = false;
let prevGp2Attack = false;
let qTable;
const epsilon = 0.1;

async function animate() {
  requestAnimationFrame(animate);
  if (isPaused) return;

  const { scale, cameraX } = calculateCamera(player1, player2);

  offscreenCtx.fillStyle = "black";
  offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  offscreenCtx.save();
  offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height);
  offscreenCtx.scale(scale, scale);
  offscreenCtx.translate(-cameraX, -canvas.height);
  offscreenCtx.imageSmoothingEnabled = false;
  offscreenCanvas.style.imageRendering = "pixelated";

  if (!player1.dead) {
    if (ai) {
      let agentAction = decisionMaking(qTable, player2, player1);
      if (Math.random() > epsilon) {
        await actionPlayer2(agentAction.index, keys, player2);
      } else {
        await actionPlayer2(agentAction.secondIndex, keys, player2);
      }
    }
  }

  background.draw(offscreenCtx);
  player1.update(offscreenCtx, groundLvl, gravity);
  player2.update(offscreenCtx, groundLvl, gravity);

  if (player1.position.x < player2.position.x) {
    player1.flip = player1.dead ? player1.flip : false;
    player2.flip = player2.dead ? player2.flip : true;
  } else {
    player1.flip = player1.dead ? player1.flip : true;
    player2.flip = player2.dead ? player2.flip : false;
  }

  player1.velocity.x = 0;
  player2.velocity.x = 0;

  resolveVerticalCollisionBetweenFighters(player1, player2);
  resolveVerticalCollisionBetweenFighters(player2, player1);

  const { gp1State, gp2State } = pollGamepadInputs(player1, player2);

  updateHorizontalMovement(
    player1,
    player2,
    keys.a.pressed || gp1State.left,
    keys.d.pressed || gp1State.right,
    "a",
    "d",
  );

  if (gp1State.jump && player1.position.y + player1.height >= groundLvl) {
    player1.velocity.y = -JUMP_VELOCITY;
  }
  updateVerticalSprite(player1);
  if (gp1State.attack && !prevGp1Attack) player1.attack();
  prevGp1Attack = gp1State.attack;

  updateHorizontalMovement(
    player2,
    player1,
    keys.ArrowLeft.pressed || gp2State.left,
    keys.ArrowRight.pressed || gp2State.right,
    "ArrowLeft",
    "ArrowRight",
  );

  if (gp2State.jump && player2.position.y + player2.height >= groundLvl) {
    player2.velocity.y = -JUMP_VELOCITY;
  }
  updateVerticalSprite(player2);
  if (gp2State.attack && !prevGp2Attack) player2.attack();
  prevGp2Attack = gp2State.attack;

  processAttackCollision(player1, player2, player2HealthBar);
  processAttackCollision(player2, player1, player1HealthBar);

  if ((player1.health <= 0 || player2.health <= 0) && !rematchRequested) {
    rematchRequested = true;
    determineWinner(player1, player2);
    showRematchModal();
    offscreenCtx.restore();
    return;
  }

  offscreenCtx.restore();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
}

// ==========================
// Keyboard Controls
// ==========================
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  if (event.key === "5") {
    isPaused = !isPaused;
    const overlay = document.getElementById("pauseOverlay");
    if (isPaused) {
      pauseTimer();
      overlay.classList.remove("hidden");
    } else {
      resumeTimer(
        (v) => (document.getElementById("timer").textContent = v),
        () => {
          determineWinner(player1, player2);
          if (!rematchRequested) {
            rematchRequested = true;
            showRematchModal();
          }
        },
      );
      overlay.classList.add("hidden");
    }
    return;
  }

  // Player 1
  if (!player1.dead) {
    switch (event.key) {
      case "s":
        keys.s.pressed = true;
        player1.lastKey = "s";
        player1.isBlocking = true;
        break;
      case "a":
        keys.a.pressed = true;
        player1.lastKey = "a";
        break;
      case "d":
        keys.d.pressed = true;
        player1.lastKey = "d";
        break;
      case "w":
        if (player1.dead || player1.isBlocking) return;
        if (player1.position.y + player1.height >= groundLvl) {
          player1.velocity.y = -JUMP_VELOCITY;
        }
        break;
      case "1":
        if (!player1.isAttacking) {
          player1.attackStyle = "style1";
          player1.attackBox = player1.sprites.attack1.attackBox;
          player1.attackFrames = player1.sprites.attack1.framesMax;
          determineDamage(player1);
          player1.attack();
        }
        break;
      case "2":
        if (!player1.isAttacking) {
          player1.attackStyle = "style2";
          player1.attackBox = player1.sprites.attack2.attackBox;
          player1.attackFrames = player1.sprites.attack2.framesMax;
          determineDamage(player1);
          player1.attack();
        }
        break;
      case "3":
        if (!player1.isAttacking) {
          player1.attackStyle = "style3";
          player1.attackBox = player1.sprites.attack3.attackBox;
          player1.attackFrames = player1.sprites.attack3.framesMax;
          determineDamage(player1);
          player1.attack();
        }
        break;
      case "4":
        if (!player1.isAttacking) {
          player1.attackStyle = "style4";
          player1.attackBox = player1.sprites.attack4.attackBox;
          player1.attackFrames = player1.sprites.attack4.framesMax;
          determineDamage(player1);
          player1.attack();
        }
        break;
    }
  }

  // Player 2
  if (!ai) {
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
          if (player2.dead || player2.isBlocking) return;
          if (player2.position.y + player2.height >= groundLvl) {
            player2.velocity.y = -JUMP_VELOCITY;
          }
          break;
        case "0":
          if (!player2.isAttacking) {
            player2.attackStyle = "style1";
            player2.attackBox = player2.sprites.attack1.attackBox;
            player2.attackFrames = player2.sprites.attack1.framesMax;
            determineDamage(player2);
            player2.attack();
          }
          break;
        case "9":
          if (!player2.isAttacking) {
            player2.attackStyle = "style2";
            player2.attackBox = player2.sprites.attack2.attackBox;
            player2.attackFrames = player2.sprites.attack2.framesMax;
            determineDamage(player2);
            player2.attack();
          }
          break;
        case "8":
          if (!player2.isAttacking) {
            player2.attackStyle = "style3";
            player2.attackBox = player2.sprites.attack3.attackBox;
            player2.attackFrames = player2.sprites.attack3.framesMax;
            determineDamage(player2);
            player2.attack();
          }
          break;
        case "7":
          if (!player2.isAttacking) {
            player2.attackStyle = "style4";
            player2.attackBox = player2.sprites.attack4.attackBox;
            player2.attackFrames = player2.sprites.attack4.framesMax;
            determineDamage(player2);
            player2.attack();
          }
          break;
      }
    }
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.key) {
    case "s":
      keys.s.pressed = false;
      player1.isBlocking = false;
      break;
    case "a":
      keys.a.pressed = false;
      break;
    case "d":
      keys.d.pressed = false;
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
