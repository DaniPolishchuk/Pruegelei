export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const gravity = 0.5;
export const JUMP_VELOCITY = CANVAS_HEIGHT / 45;
export const ATTACKBOX_WIDTH = 120;
export const ATTACKBOX_HEIGHT = -100;
export const MOVE_SPEED = CANVAS_WIDTH / 275;
export const ATTACK_FRAMES = 7;
export const SLIP_SPEED = 1;
export const groundLvl = 600;
let render = false;
let player1_actionIndex = 0;
let player2_actionIndex = 0;
let qTable = null;
// ==========================
// Imports
// ==========================
/*
import { Chart, registerables } from "chart.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import * as fs from "node:fs";
import * as SDL from "@kmamal/sdl";
import ndarray from "ndarray";
import _ from "lodash";

 */
import ndarray from "https://esm.sh/ndarray@1.0.19";
import _ from "https://esm.sh/lodash@4.17.21";

import { Fighter, setFighterData } from "./fighterClass.js";
import {
  determineDamage,
  determineWinner,
  rectangularCollision,
  updateHorizontalMovement,
  resolveVerticalCollisionBetweenFighters,
} from "./aiUtils.js";
// ==========================
// VIEW
// ==========================
/*
const window = SDL.video.createWindow({
  title: "Spiel",
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
});

 */

const rawBuffer = new Uint8Array(CANVAS_WIDTH * CANVAS_HEIGHT * 3);

function drawRectangle(xE, yE, w, h, r, g, b) {
  try {
    const x = Math.round(xE);
    const y = Math.round(yE);
    const width = Math.abs(Math.round(w));
    const height = Math.abs(Math.round(h));
    const dirX = w >= 0 ? 1 : -1;
    const dirY = h >= 0 ? 1 : -1;

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const px = x + i * dirX;
        const py = y + j * dirY;
        if (px >= 0 && px < CANVAS_WIDTH && py >= 0 && py < CANVAS_HEIGHT) {
          const index = (py * CANVAS_WIDTH + px) * 3;
          rawBuffer[index] = r;
          rawBuffer[index + 1] = g;
          rawBuffer[index + 2] = b;
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}
async function renderFrame(playerOne, playerTwo) {
  try {
    rawBuffer.fill(0);
    drawRectangle(
      CANVAS_WIDTH - 100 * 5,
      0,
      playerOne.health * 5,
      50,
      0,
      0,
      255,
    );
    drawRectangle(0, 0, playerTwo.health * 5, 50, 255, 0, 0);
    drawRectangle(
      Math.round(playerOne.position.x),
      Math.round(playerOne.position.y),
      Math.round(playerOne.width),
      Math.round(playerOne.height),
      0,
      playerOne.isBlocking ? 255 : 0,
      255,
    );
    drawRectangle(
      Math.round(playerTwo.position.x),
      Math.round(playerTwo.position.y),
      Math.round(playerTwo.width),
      Math.round(playerTwo.height),
      255,
      playerTwo.isBlocking ? 255 : 0,
      0,
    );
    if (playerOne.isAttacking) {
      drawRectangle(
        Math.round(playerOne.attackBox.position.x),
        Math.round(playerOne.attackBox.position.y),
        Math.round(playerOne.attackBox.width),
        Math.round(playerOne.attackBox.height),
        0,
        255,
        0,
      );
    }

    if (playerTwo.isAttacking) {
      drawRectangle(
        Math.round(playerTwo.attackBox.position.x),
        Math.round(playerTwo.attackBox.position.y),
        Math.round(playerTwo.attackBox.width),
        Math.round(playerTwo.attackBox.height),
        0,
        255,
        0,
      );
    }
    const nodeBuffer = Buffer.from(rawBuffer);
    window.render(
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      CANVAS_WIDTH * 3,
      "rgb24",
      nodeBuffer,
    );

    await new Promise((res) => setTimeout(res, 16));
  } catch (error) {
    console.log(error);
  }
}
// ==========================
// Input Tracking
// ==========================
// 0 = s / block
// 1 = a / left
// 2 = d / right
// 3 = w / jump
// 4 = 1 / attack
const keys = {
  s: { pressed: false },
  a: { pressed: false },
  d: { pressed: false },
  ArrowLeft: { pressed: false },
  ArrowRight: { pressed: false },
  ArrowDown: { pressed: false },
};

// ==========================
// Player SetupJUMP_VELOCITY
// ==========================
const player1 = new Fighter({
  position: { x: CANVAS_WIDTH * 0.25, y: CANVAS_HEIGHT / 5 },
  velocity: { x: 0, y: 0 },
});

const player2 = new Fighter({
  position: { x: CANVAS_WIDTH * 0.75, y: CANVAS_HEIGHT / 5 },
  velocity: { x: 0, y: 0 },
});
// ==========================
// Game Initialization
// ==========================
async function initializeGame() {
  await Promise.all([
    setFighterData(player1, false),
    setFighterData(player2, true),
    determineDamage(player1),
    determineDamage(player2),
  ]);
}
// ==========================
// Collision & Damage Handling
// ==========================
function processAttackCollision(attacker, defender) {
  if (
    attacker.isAttacking &&
    !attacker.hitLanded &&
    attacker.framesCurrent >= attacker.attackFrames / 2 &&
    rectangularCollision(attacker, defender)
  ) {
    defender.takeHit(attacker.damage);
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
// ==========================e

async function animate() {
  await action(player1_actionIndex, keys, player1);
  await actionPlayer2(player2_actionIndex, keys, player2);
  player1.update(groundLvl, gravity);
  player2.update(groundLvl, gravity);
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
    player1,
    player2,
    keys.a.pressed,
    keys.d.pressed,
    "a",
    "d",
  );
  updateHorizontalMovement(
    player2,
    player1,
    keys.ArrowLeft.pressed,
    keys.ArrowRight.pressed,
    "ArrowLeft",
    "ArrowRight",
  );
  if (render) {
    await renderFrame(player1, player2);
  }
  processAttackCollision(player1, player2);
  processAttackCollision(player2, player1);

  if (player1.health <= 0 || player2.health <= 0) {
    determineWinner(player1, player2);
  }
}
// ==========================
// AI
// ==========================
const HM_EPISODES = 44000;
const MOVE_PENALTY = 0.3;
const HURT_PENALTY = 2;
const DEAD_PENALTY = 21;
const BLOCK_REWARD = 1;
const HIT_REWARD = 10;
const KILL_REWARD = 20;
const NEAR_REWARD = 1.9;
let epsilon = 0.9;
const EPS_DECAY = 0.99995;
const SHOW_EVERY = 20000;
const start_q_table = "qtable_20250614_150937.bin";
const LEARNING_RATE = 0.1;
const DISCOUNT = 0.97;

export function relativePosition(player1, player2) {
  if (rectangularCollision(player1, player2)) {
    return 1;
  }
  if (player1.position.x > player2.position.x + player2.width) {
    return 2;
  }
  if (player1.position.x + player1.width < player2.position.x) {
    return 0;
  }
  return 0;
}

export function discretizeByDiv(value) {
  return Math.round(value / DIVISOR);
}
const DIVISOR = CANVAS_HEIGHT;
const sizeX1 = 3;
const sizeY1 = discretizeByDiv(CANVAS_HEIGHT); // Height of playing field
const sizeX2 = 2; // On the ground or not
const sizeY2 = 2; // Enemy is attacking?
const offsetY = sizeY1;
const actions = 5;

export function getBestActionAndValue(qAction_Table, x1, y1, x2, y2) {
  let maxIndex = 0;
  let maxValue = qAction_Table.get(x1, y1, x2, y2, 0);

  let secondMaxIndex = -1;
  let secondMaxValue = -Infinity;

  for (let i = 1; i < actions; i++) {
    let val = qAction_Table.get(x1, y1, x2, y2, i);
    if (val > maxValue) {
      secondMaxValue = maxValue;
      secondMaxIndex = maxIndex;

      maxValue = val;
      maxIndex = i;
    } else if (val > secondMaxValue) {
      secondMaxValue = val;
      secondMaxIndex = i;
    }
  }

  return { maxIndex, maxValue, secondMaxIndex, secondMaxValue };
}

function initializeQTable() {
  const dataLength = sizeX1 * (sizeY1 + offsetY) * sizeX2 * sizeY2 * actions;
  const bufferAI = new Float64Array(dataLength);
  qTable = ndarray(bufferAI, [
    sizeX1,
    sizeY1 + offsetY,
    sizeX2,
    sizeY2,
    actions,
  ]);
  for (let x1 = 0; x1 < sizeX1; x1++) {
    for (let y1 = 0; y1 < sizeY1 + offsetY; y1++) {
      for (let x2 = 0; x2 < sizeX2; x2++) {
        for (let y2 = 0; y2 < sizeY2; y2++) {
          for (let i = 0; i < actions; i++) {
            if (i === 3) {
              qTable.set(x1, y1, x2, y2, i, -10);
            } else {
              qTable.set(x1, y1, x2, y2, i, Math.random() * 0.01);
            }
          }
        }
      }
    }
  }
}

const now = new Date();
const timestamp =
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") +
  "_" +
  [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

function saveQTable(qTable) {
  const fileName = `qtable_${timestamp}.bin`;
  const flat = qTable.data;
  const buffer = Buffer.from(flat.buffer);
  fs.writeFileSync(fileName, buffer);
  console.log("✅ Q-Tabelle gespeichert in qtable.bin");
}

export async function loadQTableFromURL(url) {
  const shape = [sizeX1, sizeY1 + offsetY, sizeX2, sizeY2, actions];
  const totalElements = shape.reduce((a, b) => a * b);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `❌ Datei konnte nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = await response.arrayBuffer();

  const floatArray = new Float64Array(buffer);
  /*if (floatArray.length !== totalElements) {
    throw new Error(
      `❌ Datenlänge stimmt nicht. Erwartet ${totalElements}, erhalten ${floatArray.length}`,
    );
  }

   */
  return ndarray(floatArray, shape);
}

/*
export function loadQTable(url) {
  console.log("Q-Tabelle wird geladen...");
  const bufferFile = fs.readFileSync(url);
  const dataArray = new Float64Array(
    bufferFile.buffer,
    bufferFile.byteOffset,
    bufferFile.byteLength / Float64Array.BYTES_PER_ELEMENT,
  );
  qTable = ndarray(dataArray, [
    2 * sizeX1 - 1,
    2 * sizeY1 - 1,
    sizeX2,
    sizeY2,
    actions,
  ]);
}

 */

export function decisionMaking(qDecisionTable, playerOne, playerTwo) {
  let distanceX = relativePosition(playerOne, playerTwo);
  let distanceY =
    discretizeByDiv(playerOne.position.y - playerTwo.position.y) + offsetY;
  let onGround = Number(playerOne.position.y <= groundLvl);
  let enemyAttacking = Number(playerTwo.isAttacking);
  let aiAction = getBestActionAndValue(
    qDecisionTable,
    distanceX,
    distanceY,
    onGround,
    enemyAttacking,
  );
  return {
    secondIndex: aiAction.secondIndex,
    index: aiAction.maxIndex,
    distanceX: distanceX,
    distanceY: distanceY,
    onGround: onGround,
    enemyAttacking: enemyAttacking,
  };
}

async function train() {
  let player1_deaths = 0;
  let player2_deaths = 0;
  if (start_q_table.length === 0) {
    initializeQTable();
    console.log("Q-Tabelle initialisiert");
  } else {
    loadQTable(start_q_table);
  }
  let episode_rewards = [];

  for (let episode = 0; episode < HM_EPISODES; episode++) {
    await initializeGame();
    if (episode % SHOW_EVERY === 0) {
      console.log("Episode: " + episode);
      console.log("Mean reward:" + _.mean(episode_rewards));
      console.log("Player 1 deaths: " + player1_deaths);
      console.log("Player 2 deaths: " + player2_deaths);
      console.log("Epsilon" + epsilon);
      render = true;
    } else {
      render = false;
    }

    let episode_reward = 0;
    for (let step = 0; step < 1000 && !player1.dead && !player2.dead; step++) {
      let reward = 0;
      let player1_action = decisionMaking(qTable, player1, player2);
      //let player2_action = decisionMaking(player2, player1);
      if (Math.random() > epsilon) {
        player1_actionIndex = player1_action.index;
      } else {
        player1_actionIndex = Math.floor(Math.random() * actions);
      }
      do {
        player2_actionIndex = Math.floor(Math.random() * actions);
      } while (player2_actionIndex === 3);

      let distance_before = Math.abs(
        Math.round(player1.position.x - player2.position.x),
      );
      await animate();
      let distance_after = Math.abs(
        Math.round(player1.position.x - player2.position.x),
      );

      if (player2.dead) {
        player2_deaths++;
        reward = KILL_REWARD;
      } else if (player1.dead) {
        player1_deaths++;
        reward = -DEAD_PENALTY;
      } else if (player2.hitLanded) {
        if (render) {
          console.log("HIT");
        }
        reward = HIT_REWARD;
        player2.hitLanded = false;
      } else if (distance_before > distance_after) {
        if (render) {
          console.log("NEAR");
        }
        reward = NEAR_REWARD;
      } else if (player1.blocked) {
        if (render) {
          console.log("BLOCKED");
        }
        reward = BLOCK_REWARD;
        player1.blocked = false;
      } else {
        if (render) {
          //console.log("👳‍♂️✈🏢🏢");
        }
        reward = -MOVE_PENALTY;
      }

      let new_distanceX = relativePosition(player1, player2);
      let new_distanceY =
        discretizeByDiv(player1.position.y - player2.position.y) + offsetY;
      let new_onGround = Number(player1.position.y <= groundLvl);
      let new_enemyAttacking = Number(player2.isAttacking);

      let { maxValue } = getBestActionAndValue(
        qTable,
        new_distanceX,
        new_distanceY,
        new_onGround,
        new_enemyAttacking,
      );
      let current_q = qTable.get(
        player1_action.distanceX,
        player1_action.distanceY,
        player1_action.onGround,
        player1_action.enemyAttacking,
        player1_actionIndex,
      );
      let new_q = 0;
      if (reward === KILL_REWARD) {
        new_q = KILL_REWARD;
      } else if (reward === HIT_REWARD) {
        new_q = HIT_REWARD;
      } else if (reward === -HURT_PENALTY) {
        new_q = -HURT_PENALTY;
      } else if (reward === -DEAD_PENALTY) {
        new_q = -DEAD_PENALTY;
      } else if (reward === BLOCK_REWARD) {
        new_q = BLOCK_REWARD;
      } else {
        new_q =
          (1 - LEARNING_RATE) * current_q +
          LEARNING_RATE * (reward + DISCOUNT * maxValue);
      }
      qTable.set(
        player1_action.distanceX,
        player1_action.distanceY,
        player1_action.onGround,
        player1_action.enemyAttacking,
        player1_actionIndex,
        new_q,
      );
      episode_reward += reward;
    }
    episode_rewards.push(episode_reward);
    if (epsilon > 0.05) {
      epsilon *= EPS_DECAY;
    }
  }
  await makeChart(episode_rewards, "chart.png");
  saveQTable(qTable);
}

/*
async function makeChart(episoderewards) {
  Chart.register(...registerables);
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const windowSize = 100; // Größe des gleitenden Fensters
  const sampleEvery = 100; // Intervall für jeden N-ten Wert

  // 1) Erzeuge die Indizes, bei denen wir die MA berechnen wollen
  const sampleIndices = _.range(
    windowSize - 1,
    episoderewards.length,
    sampleEvery,
  );

  // 2) Berechne den gleitenden Durchschnitt nur an diesen Indizes
  const moving_avg = sampleIndices.map((i) => {
    const slice = episoderewards.slice(Math.max(0, i - windowSize + 1), i + 1);
    return _.mean(slice);
  });

  // 3) Labels = die originalen Episoden-Indizes der Sample-Punkte
  const labels = sampleIndices;

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Reward (${windowSize}-Episode MA every ${sampleEvery})`,
          data: moving_avg,
          borderColor: "#FF0000",
          backgroundColor: "rgba(255, 0, 0, 0.2)",
          fill: true,
        },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: "Episode #" } },
        y: { title: { display: true, text: "Moving Average" } },
      },
    },
  };
  const chartName = `chart_learningRate_${timestamp}.png`;

  const image = await chartJSNodeCanvas.renderToBuffer(chartConfig);
  fs.writeFileSync(chartName, image, "base64");
  console.log("Chart saved");
}


 */
//bis hier

// ==========================
// Controls
// ==========================
export async function action(choice, keys, player) {
  keys.s.pressed = false;
  keys.a.pressed = false;
  keys.d.pressed = false;
  player.isBlocking = false;
  player.lastKey = null;

  if (!player.dead) {
    switch (choice) {
      case 0:
        keys.s.pressed = true;
        player.lastKey = "s";
        player.isBlocking = true;
        break;
      case 1:
        keys.a.pressed = true;
        player.lastKey = "a";
        break;
      case 2:
        keys.d.pressed = true;
        player.lastKey = "d";
        break;
      case 3:
        if (player.dead || player.isBlocking) return;
        if (player.position.y + player.height >= groundLvl) {
          player.velocity.y = -JUMP_VELOCITY;
        }
        break;
      case 4:
        if (!player.isAttacking) {
          player.attack();
          await determineDamage(player);
          player.attackFrames = 7;
          player.framesMax = 7;
        }
        break;
      default:
        break;
    }
  }
}

export async function actionPlayer2(choice, keys, player) {
  keys.ArrowDown.pressed = false;
  keys.ArrowLeft.pressed = false;
  keys.ArrowRight.pressed = false;
  player.isBlocking = false;
  player.lastKey = null;

  if (!player.dead) {
    switch (choice) {
      case 0:
        keys.ArrowDown.pressed = true;
        player.lastKey = "ArrowDown";
        player.isBlocking = true;
        break;
      case 1:
        keys.ArrowLeft.pressed = true;
        player.lastKey = "ArrowLeft";
        break;
      case 2:
        keys.ArrowRight.pressed = true;
        player.lastKey = "ArrowRight";
        break;
      case 3:
        if (player.dead || player.isBlocking) return;
        if (player.position.y + player.height >= groundLvl) {
          player.velocity.y = -JUMP_VELOCITY;
        }
        break;
      case 4:
        if (!player.isAttacking) {
          player.attack();
          await determineDamage(player);
          player.attackFrames = 7;
          player.framesMax = 7;
        }
        break;
      default:
        break;
    }
  }
}
async function gameLoop() {
  render = true;
  loadQTable(start_q_table);

  for (let i = 0; i < 1000000; i++) {
    await initializeGame();
    for (let i = 0; i < 2000 && !player1.dead && !player2.dead; i++) {
      let player1_action = decisionMaking(qTable, player1, player2);
      let player2_action = decisionMaking(qTable, player2, player1);

      player1_actionIndex = player1_action.index;
      do {
        player2_actionIndex = Math.floor(Math.random() * actions);
      } while (player2_actionIndex === 3 || player2_actionIndex === 0);
      await animate();
    }
  }
}

