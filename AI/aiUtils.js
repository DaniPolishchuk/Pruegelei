// ==========================
// Imports
// ==========================
import ndarray from "https://esm.sh/ndarray@1.0.19";
import { rectangularCollision } from "../utils.js";

export const CANVAS_HEIGHT = 720;
const DIVISOR = CANVAS_HEIGHT;
export const JUMP_VELOCITY = CANVAS_HEIGHT / 45;
export const groundLvl = 600;
export const sizeX1 = 3;
export const sizeY1 = discretizeByDiv(CANVAS_HEIGHT); // Height of playing field
export const sizeX2 = 2; // On the ground or not
export const sizeY2 = 2; // Enemy is attacking?
export const offsetY = sizeY1;
export const actions = 5;

export function discretizeByDiv(value) {
  return Math.round(value / DIVISOR);
}

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

export async function loadQTableFromURL(url) {
  const shape = [sizeX1, sizeY1 + offsetY, sizeX2, sizeY2, actions];

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `❌ Datei konnte nicht geladen werden: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = await response.arrayBuffer();

  const floatArray = new Float64Array(buffer);
  return ndarray(floatArray, shape);
}

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
// ==========================
// Controls
// ==========================
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
          player.attackStyle = "style1";
          player.attack();
          player.attackbox = player.sprites.attack1.attackBox;
          player.framesMax = player.sprites.attack1.framesMax;
          console.log(player.framesMax);
          console.log(player.attackFrames);
          await determineDamage(player);
          console.log(player.damage);
        }
        break;
      default:
        break;
    }
  }
}

export async function determineDamage(player) {
  const avgSurface = 26759.23;
  const avgFramesCount = 8.1;
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
