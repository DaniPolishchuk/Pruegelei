// ==========================
// Imports
// ==========================
import ndarray from "ndarray";
// ==========================
// CONSTANTS
// ==========================
export const CANVAS_WIDTH = 1280;
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
const SLIP_SPEED = 1;
const MOVE_SPEED = CANVAS_WIDTH / 275;

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
          player.framesMax = 7;
          await determineDamage(player);
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
    rightPressed && player1.position.x + player1.width < CANVAS_WIDTH;

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
  } else if (canMoveRight) {
    player1.velocity.x = MOVE_SPEED;
    player1.lastKey = rightKey;
  } else {
    //tie
  }
}

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
  if (p1.health > p2.health) {
    p2.dead = true;
  } else if (p1.health < p2.health) {
    p1.dead = true;
  }
}
