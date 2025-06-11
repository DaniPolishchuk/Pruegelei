// ==========================
// Imports
// ==========================
import { Fighter, Sprite } from "../classes.js";
import {
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

// ==========================
// Socket connection
// ==========================
// eslint-disable-next-line no-undef
const socket = io();
const room = sessionStorage.getItem("room");
const clientId = localStorage.getItem("clientId");
socket.emit("joinRoom", { roomName: room, clientId });
socket.emit("startGame", room);
const overlay = document.getElementById("pauseOverlay");
let isPaused = false;

let rematchRequested = false;
socket.on("showRematchModal", () => {
  setTimeout(function () {
    [yesBtn, reselectBtn, noBtn].forEach((btn) => (btn.disabled = false));

    header.textContent = "Rematch?";

    yesBtn.onclick = () => {
      socket.emit("rematchResponse", { roomName: room, decision: true });
      header.textContent = "Waiting…";
      [yesBtn, reselectBtn, noBtn].forEach((btn) => (btn.disabled = true));
    };

    reselectBtn.onclick = () => {
      socket.emit("reselectResponse", { roomName: room });
      header.textContent = "Waiting for reselect vote…";
      [yesBtn, reselectBtn, noBtn].forEach((btn) => (btn.disabled = true));
    };

    noBtn.onclick = () => {
      socket.emit("rematchResponse", { roomName: room, decision: false });
      header.textContent = "Leaving…";
      [yesBtn, reselectBtn, noBtn].forEach((btn) => (btn.disabled = true));
    };

    modal.style.display = "flex";
  }, 3000);
});

socket.on("rematchStart", () => {
  window.location.href = "/fight";
});

socket.on("reselectFighters", () => {
  window.location.href = "/fighterSelection";
});

socket.on("rematchEnd", () => {
  window.location.href = "/";
});

socket.on("timerTick", (remaining) => {
  if (!player1.dead && !player2.dead) {
    document.getElementById("timer").textContent = remaining;
  }
});

socket.on("timerEnd", () => {
  determineWinner(player1, player2);
  socket.emit("requestRematch", { roomName: room });
});

socket.on("timerPaused", (remaining) => {
  isPaused = true;
  overlay.classList.remove("hidden");
  document.getElementById("timer").textContent = remaining;
});

socket.on("timerResumed", (remaining) => {
  isPaused = false;
  overlay.classList.add("hidden");
  document.getElementById("timer").textContent = remaining;
});

// ==========================
// Key state definitions
// ==========================
const keys = {
  s: { pressed: false },
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
};

const remoteKeys = {
  s: { pressed: false },
  a: { pressed: false },
  d: { pressed: false },
  w: { pressed: false },
};

let groundLvl, backgroundSprite;
let prevGpAttack = false;

// ==========================
// Game setup
// ==========================
async function setUpGame() {
  const { imageSrc, groundLevel, borderBackground } = await setBackground(
    sessionStorage.getItem("background"),
  );

  videoSource.src = borderBackground;
  videoElement.load();

  setSong(audio, window.sessionStorage.getItem("song"));

  groundLvl = groundLevel;
  backgroundSprite = new Sprite({
    position: { x: 0, y: 0 },
    imageSrc,
    width: canvas.width,
    height: canvas.height,
  });

  await initializeGame();
  requestAnimationFrame(animate);
}

async function initializeGame() {
  await Promise.all([
    setFighterData(player1, false, sessionStorage.getItem("player1")),
    setFighterData(player2, true, sessionStorage.getItem("player2")),
  ]);
  await Promise.all([determineDamage(player1), determineDamage(player2)]);
}

// ==========================
// Start game
// ==========================
setUpGame();

// ==========================
// Player setup
// ==========================
const myPlayerId = Number(sessionStorage.getItem("playerId")); // 1 or 2
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

const localFighter = myPlayerId === 1 ? player1 : player2;
const remoteFighter = myPlayerId === 1 ? player2 : player1;

// ==========================
// Socket: Input & hit sync
// ==========================
socket.on("remoteInput", ({ key, pressed }) => {
  if (Object.prototype.hasOwnProperty.call(remoteKeys, key))
    remoteKeys[key].pressed = pressed;
});

socket.on("confirmedHit", ({ defenderId, damage }) => {
  const defender = defenderId === myPlayerId ? localFighter : remoteFighter;
  defender.takeHit(damage);
  const bar = defenderId === 1 ? player1HealthBar : player2HealthBar;
  bar.style.width = Math.max(defender.health, 0) + "%";
});

socket.on("remoteState", (data) => {
  if (data.clientId === clientId) return;
  if (data.isDead) {
    if (remoteFighter.currentSpriteName !== "death") {
      remoteFighter.switchSprite("death");
      remoteFighter.framesCurrent = data.frame;
      remoteFighter.dead = true;
    }
    return;
  }
  remoteFighter.position.x = data.x;
  remoteFighter.position.y = data.y;
  remoteFighter.flip = data.flip;
  remoteFighter.isBlocking = !!data.block;
  remoteFighter.health = data.health;

  if ((remoteFighter.isAttacking && !data.attack) || remoteFighter.isBlocking)
    return;

  if (data.sprite && remoteFighter.sprites?.[data.sprite]) {
    const spr = remoteFighter.sprites[data.sprite];
    remoteFighter.image = spr.image;
    remoteFighter.framesMax = spr.framesMax;
    remoteFighter.framesCurrent = data.frame;
  }

  if (data.attack) {
    if (!remoteFighter.isAttacking) {
      const style = data.attackStyle || "style1";
      const spriteKey = `attack${style.slice(-1)}`;
      if (remoteFighter.sprites?.[spriteKey]) {
        remoteFighter.switchSprite(spriteKey);
        remoteFighter.attackBox = remoteFighter.sprites[spriteKey].attackBox;
        remoteFighter.attackFrames = remoteFighter.sprites[spriteKey].framesMax;
        remoteFighter.isAttacking = true;
      }
    }
  }

  const bar =
    myPlayerId === 1
      ? document.querySelector("#player2Health")
      : document.querySelector("#player1Health");
  bar.style.width = Math.max(data.health, 0) + "%";
});

// ==========================
// Start attack
// ==========================
function startAttack(styleIdx) {
  const spriteKey = `attack${styleIdx}`;
  if (localFighter.isAttacking) return;
  localFighter.attackStyle = `style${styleIdx}`;
  localFighter.attack();
  localFighter.attackBox = localFighter.sprites[spriteKey].attackBox;
  localFighter.attackFrames = localFighter.sprites[spriteKey].framesMax;
  localFighter.hitLanded = false;
  sendMyState();
}

// ==========================
// Collision processing
// ==========================
function processAttackCollision(attacker, defender) {
  if (defender.dead) return;
  if (
    attacker.currentSpriteName.startsWith("attack") &&
    !attacker.hitLanded &&
    attacker.framesCurrent >= attacker.attackFrames / 2
  ) {
    if (rectangularCollision(attacker, defender) && attacker === localFighter) {
      socket.emit("hit", {
        roomName: room,
        attackerId: myPlayerId,
        defenderId: myPlayerId === 1 ? 2 : 1,
        damage: attacker.damage,
      });
      attacker.hitLanded = true;
    }
  }
}

// ==========================
// Sync local state
// ==========================
function sendMyState() {
  socket.emit("state", {
    room,
    clientId: clientId,
    x: localFighter.position.x,
    y: localFighter.position.y,
    vx: localFighter.velocity.x,
    vy: localFighter.velocity.y,
    flip: localFighter.flip,
    sprite: localFighter.currentSpriteName,
    frame: localFighter.framesCurrent,
    attack: localFighter.isAttacking,
    attackStyle: localFighter.attackStyle,
    block: localFighter.isBlocking,
    health: localFighter.health,
    isDead: localFighter.dead,
  });
}

// ==========================
// Animation loop
// ==========================
function animate() {
  requestAnimationFrame(animate);
  if (isPaused) return;
  const { gp1State } = pollGamepadInputs(localFighter, remoteFighter);

  localFighter.isBlocking = keys.s.pressed || gp1State.block;

  if (
    localFighter.isAttacking &&
    localFighter.framesCurrent >= localFighter.framesMax - 1
  ) {
    localFighter.isAttacking = false;
  }

  const { scale, cameraX } = calculateCamera(player1, player2);
  offscreenCtx.fillStyle = "black";
  offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

  offscreenCtx.save();
  offscreenCtx.translate(offscreenCanvas.width / 2, offscreenCanvas.height);
  offscreenCtx.scale(scale, scale);
  offscreenCtx.translate(-cameraX, -canvas.height);
  offscreenCtx.imageSmoothingEnabled = false;
  offscreenCanvas.style.imageRendering = "pixelated";

  backgroundSprite.draw(offscreenCtx);
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

  updateHorizontalMovement(
    localFighter,
    remoteFighter,
    keys.a.pressed || gp1State.left,
    keys.d.pressed || gp1State.right,
    "a",
    "d",
  );
  if (
    !localFighter.isBlocking &&
    !localFighter.dead &&
    (keys.w.pressed || gp1State.jump) &&
    localFighter.position.y + localFighter.height >= groundLvl
  ) {
    localFighter.velocity.y = -JUMP_VELOCITY;
  }
  updateVerticalSprite(localFighter);

  if (gp1State.attack && !prevGpAttack) {
    localFighter.attack();
  }
  prevGpAttack = gp1State.attack;

  processAttackCollision(player1, player2, player2HealthBar);
  processAttackCollision(player2, player1, player1HealthBar);

  if ((player1.health <= 0 || player2.health <= 0) && !rematchRequested) {
    rematchRequested = true;
    determineWinner(player1, player2);
    socket.emit("requestRematch", { roomName: room });
    offscreenCtx.restore();
    return;
  }

  offscreenCtx.restore();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreenCanvas, 0, 0);
  sendMyState();
}

// ==========================
// Key event listeners
// ==========================
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.key === "s") {
    keys.s.pressed = true;
    localFighter.isBlocking = true;
    sendMyState();
  }

  if (Object.prototype.hasOwnProperty.call(keys, event.key))
    keys[event.key].pressed = true;
  socket.emit("playerInput", { roomName: room, key: event.key, pressed: true });

  if (["1", "2", "3", "4"].includes(event.key)) startAttack(event.key);
});

window.addEventListener("keyup", (event) => {
  if (!Object.prototype.hasOwnProperty.call(keys, event.key)) return;
  if (event.key === "s") {
    localFighter.isBlocking = false;
    sendMyState();
  }
  keys[event.key].pressed = false;
  socket.emit("playerInput", {
    roomName: room,
    key: event.key,
    pressed: false,
  });
});

window.addEventListener("keydown", (e) => {
  if (e.key === "5" && !e.repeat) {
    socket.emit("togglePause", { roomName: room });
  }
});
