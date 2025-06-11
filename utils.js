// ==============================
// Canvas Setup & Global Constants
// ==============================

export const offscreenCanvas = document.createElement("canvas");
export const offscreenCtx = offscreenCanvas.getContext("2d");
offscreenCanvas.width = 1280;
offscreenCanvas.height = 720;

export const canvas = document.querySelector("canvas");
export const ctx = canvas?.getContext("2d") ?? offscreenCtx;
if (canvas) {
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.imageRendering = "pixelated";
}
ctx.imageSmoothingEnabled = false;

const MOVE_SPEED = canvas?.width / 275;
const SLIP_SPEED = 1;
export const JUMP_VELOCITY = canvas?.height / 45;
export const gravity = 0.5;

// ==============================
// UI Elements
// ==============================

export const player1HealthBar = document.querySelector("#player1Health");
export const player2HealthBar = document.querySelector("#player2Health");

export const videoSource = document.getElementById("videoSource");
export const videoElement = document.getElementById("borderBackground");

export const player1canvas = document.getElementById("player1canvas");
export const player2canvas = document.getElementById("player2canvas");

if (player1canvas && player2canvas) {
  player1canvas.width = player1canvas.offsetWidth;
  player1canvas.height = player1canvas.offsetHeight;
  player2canvas.width = player2canvas.offsetWidth;
  player2canvas.height = player2canvas.offsetHeight;
}

export const readyButton1 = document.getElementById("readyButton1");
export const readyButton2 = document.getElementById("readyButton2");
export const startButton = document.getElementById("startButton");

export const bgs = document.getElementById("backgrounds");

export const audio = document.getElementById("backgroundMelody");

export const modal = document.getElementById("rematchModal");
export const reselectBtn = document.getElementById("rematchReselect");
export const yesBtn = document.getElementById("rematchYes");
export const noBtn = document.getElementById("rematchNo");
export const header = modal?.querySelector("h2");
// ==============================
// Collision Detection & Winner
// ==============================

export function rectangularCollision(f1, f2) {
  const { position: p1, width: w1, height: h1 } = f1.attackBox;
  const left1 = p1.x,
    right1 = p1.x + w1;
  const top1 = Math.min(p1.y, p1.y + h1),
    bottom1 = Math.max(p1.y, p1.y + h1);
  const left2 = f2.position.x,
    right2 = f2.position.x + f2.width;
  const top2 = f2.position.y,
    bottom2 = f2.position.y + f2.height;

  return (
    right1 >= left2 && left1 <= right2 && bottom1 >= top2 && top1 <= bottom2
  );
}

export function determineWinner(p1, p2) {
  pauseTimer();
  const resEl = document.querySelector("#gameResult");
  resEl.style.display = "flex";
  if (p1.health > p2.health) {
    p2.switchSprite("death");
    p2.dead = true;
    resEl.textContent = "Player1 won";
  } else if (p1.health < p2.health) {
    p1.switchSprite("death");
    p1.dead = true;
    resEl.textContent = "Player2 won";
  } else resEl.textContent = "Tie";
}

// ==============================
// Timer Logic
// ==============================
let timerId = null;
let remaining = 0;

export function startTimer(initialSeconds, onTick, onEnd) {
  remaining = initialSeconds;
  onTick(remaining);

  timerId = setInterval(() => {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(timerId);
      onEnd();
    }
  }, 1000);
}

export function pauseTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

export function resumeTimer(onTick, onEnd) {
  if (timerId) return; // already running
  onTick(remaining);
  timerId = setInterval(() => {
    remaining--;
    onTick(remaining);
    if (remaining <= 0) {
      clearInterval(timerId);
      onEnd();
    }
  }, 1000);
}

// ==============================
// Fetching Data (Fighters, Backgrounds, Shield)
// ==============================

export async function getFighters() {
  try {
    const response = await fetch("/fighters");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching fighters:", error);
    return [];
  }
}

async function getBackgrounds() {
  try {
    const response = await fetch("/backgrounds");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching backgrounds:", error);
    return [];
  }
}

async function getSongs() {
  try {
    const response = await fetch("/music");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching shield image:", error);
    return [];
  }
}

// ==============================
// Fighter & Background Setup
// ==============================

export async function setFighterData(player, flip, fighterName) {
  try {
    const fighters = await getFighters();
    const fighter = fighters.find((f) => f.name === fighterName);
    if (!fighter) {
      console.error(`Fighter "${fighterName}" not found.`);
      return;
    }

    // Basic player config
    player.scale = fighter.scale;
    player.image = new Image();
    player.image.src = `/Assets/Fighters/${fighterName}/idle.png`;
    player.framesMax = fighter.idleFrames;
    player.offset = { x: fighter.offsetX, y: fighter.offsetY };
    player.flip = flip;
    player.gender = fighter.gender;

    // Base attack box config
    const baseAttackBoxOffset = {
      x: fighter.attackBoxOffsetX,
      y: fighter.attackBoxOffsetY,
    };
    player.baseAttackBoxOffset = baseAttackBoxOffset;

    const createAttackBox = (attackKey) => {
      const width = fighter[`${attackKey}Width`];
      const height = fighter[`${attackKey}Height`];
      const offsetX = flip
        ? player.width - baseAttackBoxOffset.x - width
        : baseAttackBoxOffset.x;
      return {
        position: { x: player.position.x, y: player.position.y },
        offset: { x: offsetX, y: baseAttackBoxOffset.y },
        width,
        height,
      };
    };

    const spriteMapping = {
      idle: { framesKey: "idleFrames" },
      run: { framesKey: "runFrames" },
      jump: { framesKey: "jumpFrames", fallback: "idle" },
      fall: { framesKey: "fallFrames", fallback: "idle" },
      attack1: { framesKey: "attack1Frames", hasAttackBox: true },
      attack2: {
        framesKey: "attack2Frames",
        hasAttackBox: true,
        fallback: "attack1",
      },
      attack3: {
        framesKey: "attack3Frames",
        hasAttackBox: true,
        fallback: "attack2",
      },
      attack4: {
        framesKey: "attack4Frames",
        hasAttackBox: true,
        fallback: "attack3",
      },
      takeHit: { framesKey: "takeHitFrames" },
      death: { framesKey: "deathFrames" },
      block: { framesKey: "blockFrames" },
    };

    async function tryLoadImage(path) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = path;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }

    player.sprites = {};
    for (let [state, config] of Object.entries(spriteMapping)) {
      let usedState = state;
      let imagePath = `/Assets/Fighters/${fighterName}/${state}.png`;
      let image = await tryLoadImage(imagePath);

      // Fallback check
      while (!image && config.fallback) {
        usedState = config.fallback;
        imagePath = `/Assets/Fighters/${fighterName}/${usedState}.png`;
        image = await tryLoadImage(imagePath);
        config = spriteMapping[usedState];
      }

      // For block, if still no image, explicitly set null
      if (state === "block" && !image) {
        player.sprites[state] = {
          image: null,
          imageSrc: null,
          framesMax: 0,
        };
        continue;
      }

      const framesMax = fighter[config.framesKey];

      player.sprites[state] = {
        image,
        imageSrc: imagePath,
        framesMax,
      };

      if (config.hasAttackBox) {
        player.sprites[state].attackBox = createAttackBox(usedState);
      }
    }

    // Setup attackBox from attack1
    const attackBoxWidth = fighter.attack1Width;
    const attackBoxOffsetX = flip
      ? baseAttackBoxOffset.x - attackBoxWidth
      : baseAttackBoxOffset.x;

    player.attackBox = {
      position: { x: player.position.x, y: player.position.y },
      offset: { x: attackBoxOffsetX, y: baseAttackBoxOffset.y },
      width: attackBoxWidth,
      height: fighter.attack1Height,
    };

    player.attackFrames = fighter.attack1Frames;
  } catch (error) {
    console.error("Error setting fighter data:", error);
  }
}

export async function setFighters(player1, player2) {
  const fighterName1 = sessionStorage.getItem("player1");
  const fighterName2 = sessionStorage.getItem("player2");

  getFighters().then((fighters) => {
    const f1 = fighters.find((f) => f.name === fighterName1);
    player1.setImage(`/Assets/Fighters/${f1.name}/idle.png`);
    player1.scale = f1.backgroundSelectionScale;
    player1.framesMax = f1.idleFrames;
    player1.offset = {
      x: f1.backgroundSelectionOffsetX,
      y: f1.backgroundSelectionOffsetY,
    };
    player1.framesHold = 8;

    const f2 = fighters.find((f) => f.name === fighterName2);
    player2.setImage(`/Assets/Fighters/${f2.name}/idle.png`);
    player2.scale = f2.backgroundSelectionScale;
    player2.framesMax = f2.idleFrames;
    player2.offset = {
      x: f2.backgroundSelectionOffsetX,
      y: f2.backgroundSelectionOffsetY,
    };
    player2.framesHold = 8;
  });
}

export async function setBackground(bgName) {
  const backgrounds = await getBackgrounds();
  const bg = backgrounds.find((f) => f.name === bgName);
  return {
    imageSrc: `/Assets/Backgrounds/${bgName}/image.jpeg`,
    groundLevel: 720 / bg.groundLevel,
    borderBackground: `/Assets/Backgrounds/${bgName}/video.bin`,
  };
}

export async function setBackgrounds(bgs) {
  try {
    const backgrounds = await getBackgrounds();
    backgrounds.forEach((bg) => {
      const img = document.createElement("img");
      img.src = `/Assets/Backgrounds/${bg.name}/image.jpeg`;
      img.className = "backgroundImage";
      img.alt = bg.name;
      bgs.appendChild(img);
    });
  } catch (err) {
    console.error("Error loading backgrounds:", err);
  }
}

export async function setSong(audioElement, currentSong = null) {
  try {
    if (currentSong) {
      audioElement.src = `/Assets/Music/${currentSong}.bin`;
    } else {
      // Select a random song if none is saved
      const songs = await getSongs();
      const randomSong = songs[Math.floor(Math.random() * songs.length)];
      audioElement.src = `/Assets/Music/${randomSong.name}.bin`;
      sessionStorage.setItem("song", randomSong.name);
    }

    audioElement.volume = 0.25;
    audioElement.loop = false;
    audioElement.muted = false;

    // Play the song if ready
    const playSong = async () => {
      try {
        await audioElement.play();
      } catch (err) {
        console.log("Playback prevented:", err);
      }
    };

    // Add interaction listeners to trigger play
    const userTriggeredPlay = async () => {
      await playSong();
      // Remove listeners after playback starts
      document.removeEventListener("click", userTriggeredPlay);
      document.removeEventListener("keydown", userTriggeredPlay);
    };

    if (audioElement.paused) {
      // Add event listeners for user input
      document.addEventListener("click", userTriggeredPlay);
      document.addEventListener("keydown", userTriggeredPlay);
    } else {
      await playSong();
    }

    // Play a new song after the current one ends
    audioElement.addEventListener("ended", async () => {
      const songs = await getSongs();
      const currentSong = sessionStorage.getItem("song"); // Get the current song
      const nextSong =
        songs.find((song) => song.name !== currentSong) || songs[0]; // Pick the next song
      sessionStorage.setItem("song", nextSong.name); // Save the next song
      await setSong(audioElement, nextSong.name); // Play the next song
    });
  } catch (error) {
    console.error("Error in setSong:", error);
  }
}

// ==============================
// Game Mechanics
// ==============================

export function calculateCamera(player1, player2) {
  const margin = 100;
  const maxZoom = 1.8;
  const worldLeft = 0;
  const worldRight = canvas.width;

  const playerLeft = Math.min(player1.position.x, player2.position.x);
  const playerRight = Math.max(
    player1.position.x + player1.width,
    player2.position.x + player2.width,
  );

  const requiredViewWidth = playerRight - playerLeft + 2 * margin;
  let candidateScale = canvas.width / requiredViewWidth;

  let effectiveScale = Math.max(candidateScale, 1);
  effectiveScale = effectiveScale > maxZoom ? maxZoom : effectiveScale;

  let desiredCenterX = (playerLeft + playerRight) / 2;
  const halfViewWidth = canvas.width / effectiveScale / 2;
  desiredCenterX = Math.max(
    worldLeft + halfViewWidth,
    Math.min(desiredCenterX, worldRight - halfViewWidth),
  );

  return { scale: effectiveScale, cameraX: desiredCenterX };
}

export function updateHorizontalMovement(
  player1,
  player2,
  leftPressed,
  rightPressed,
  leftKey,
  rightKey,
) {
  if (
    player1.isAttacking ||
    player1.isBlocking ||
    player1.dead ||
    player1.currentSpriteName === "takeHit"
  )
    return;
  let canMoveLeft = leftPressed && player1.position.x > 0;
  let canMoveRight =
    rightPressed && player1.position.x + player1.width < canvas.width;

  if (
    player1.hitbox.position.y + player1.hitbox.height >
    player2.hitbox.position.y
  ) {
    if (player1.flip) {
      canMoveLeft =
        canMoveLeft &&
        player1.hitbox.position.x >
          player2.hitbox.position.x + player2.hitbox.width;
    } else {
      canMoveRight =
        canMoveRight &&
        player1.hitbox.position.x + player1.hitbox.width <
          player2.hitbox.position.x;
    }
  }

  if (canMoveLeft) {
    player1.velocity.x = -MOVE_SPEED;
    player1.lastKey = leftKey;
    player1.switchSprite("run");
  } else if (canMoveRight) {
    player1.velocity.x = MOVE_SPEED;
    player1.lastKey = rightKey;
    player1.switchSprite("run");
  } else {
    player1.switchSprite("idle");
  }
}

export function updateVerticalSprite(player) {
  if (
    player.isBlocking ||
    player.dead ||
    player.currentSpriteName === "takeHit"
  )
    return;
  if (player.velocity.y < 0) {
    player.switchSprite("jump");
  } else if (player.velocity.y > 0) {
    player.switchSprite("fall");
  }
}

export function resolveVerticalCollisionBetweenFighters(player1, player2) {
  if (player1.velocity.y > 0) {
    if (
      player1.hitbox.position.x <
        player2.hitbox.position.x + player2.hitbox.width &&
      player1.hitbox.position.x + player1.hitbox.width >
        player2.hitbox.position.x
    ) {
      if (
        player1.hitbox.position.y + player1.hitbox.height >
          player2.hitbox.position.y &&
        player1.hitbox.position.y < player2.hitbox.position.y
      ) {
        player1.hitbox.position.y =
          player2.hitbox.position.y - player1.hitbox.height;
        player1.velocity.y = 0;

        const fighterCenter =
          player1.hitbox.position.x + player1.hitbox.width / 2;
        const otherCenter =
          player2.hitbox.position.x + player2.hitbox.width / 2;

        player1.velocity.x =
          fighterCenter < otherCenter ? -SLIP_SPEED : SLIP_SPEED;
      }
    }
  }
}

export function SoundEffect(src, volume = 0.4) {
  const audio = new Audio(src);
  audio.volume = volume;
  return {
    play: () => {
      // Create a new instance for each play to allow overlapping sounds
      const sound = audio.cloneNode();
      sound.play().catch((err) => console.log("Sound effect prevented:", err));
      // Clean up the cloned audio element after it finishes playing
      sound.addEventListener("ended", () => sound.remove());
    },
  };
}

// ==============================
// Damage Calculation
// ==============================

async function getAvgAttackSurface() {
  const fighters = await getFighters();
  let totalSurface = 0,
    count = 0;

  function add(h, w) {
    totalSurface += Math.abs(h) * w;
    count++;
  }

  fighters.forEach((f) => {
    add(f.attack1Height, f.attack1Width);
    if (f.attack2 && f.attack2 !== f.attack1)
      add(f.attack2Height, f.attack2Width);
    if (f.attack3 && f.attack3 !== f.attack2)
      add(f.attack3Height, f.attack3Width);
    if (f.attack4 && f.attack4 !== f.attack3)
      add(f.attack4Height, f.attack4Width);
  });

  return count ? totalSurface / count : 0;
}

async function getAvgAttackFramesCount() {
  const fighters = await getFighters();
  let totalFrames = 0,
    count = 0;

  fighters.forEach((f) => {
    totalFrames += f.attack1Frames;
    count++;
    if (f.attack2 && f.attack2 !== f.attack1) {
      totalFrames += f.attack2Frames;
      count++;
    }
    if (f.attack3 && f.attack3 !== f.attack2) {
      totalFrames += f.attack3Frames;
      count++;
    }
    if (f.attack4 && f.attack4 !== f.attack3) {
      totalFrames += f.attack4Frames;
      count++;
    }
  });

  return count ? totalFrames / count : 0;
}

export async function determineDamage(player) {
  const avgSurface = await getAvgAttackSurface();
  const avgFramesCount = await getAvgAttackFramesCount();
  if (!avgSurface || !avgFramesCount) {
    player.damage = 0;
    return;
  }
  const surface = player.attackBox.width * Math.abs(player.attackBox.height);
  const framesCount = player.framesMax;
  const calculatedDamage =
    5 / (surface / avgSurface) / (avgFramesCount / framesCount);
  player.damage = calculatedDamage > 10 ? 10 : calculatedDamage;
}

// ==============================
// Gamepad Support
// ==============================

export function pollGamepadInputs(player1, player2) {
  const gamepads = navigator.getGamepads();
  const threshold = 0.2;

  const createGamepadState = (gp) => ({
    left: gp.axes[0] < -threshold || gp.buttons[14].pressed,
    right: gp.axes[0] > threshold || gp.buttons[15].pressed,
    jump: gp.axes[1] < -threshold || gp.buttons[12].pressed,
    attack: false,
    attackStyle: null,
    block:
      gp.buttons[0].pressed ||
      gp.buttons[1].pressed ||
      gp.buttons[2].pressed ||
      gp.buttons[3].pressed,
  });

  const gp1State =
    !player1.dead && gamepads[0] ? createGamepadState(gamepads[0]) : {};
  const gp2State =
    !player2.dead && gamepads[1] ? createGamepadState(gamepads[1]) : {};

  const attackMapping = [
    { button: 4, style: "style1", sprite: "attack1" },
    { button: 5, style: "style2", sprite: "attack2" },
    { button: 7, style: "style3", sprite: "attack3" },
    { button: 6, style: "style4", sprite: "attack4" },
  ];

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
