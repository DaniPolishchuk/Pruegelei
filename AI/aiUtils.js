import {
  CANVAS_WIDTH,
  ATTACKBOX_HEIGHT,
  ATTACKBOX_WIDTH,
  MOVE_SPEED,
  ATTACK_FRAMES,
  SLIP_SPEED,
  CANVAS_HEIGHT,
} from "./gameLogic.js";

export function mapToPositive(value) {
  return (
    value +
    Math.sqrt(CANVAS_HEIGHT * CANVAS_HEIGHT + CANVAS_WIDTH * CANVAS_WIDTH)
  );
}

export function updateHorizontalMovement(
  player1,
  player2,
  leftPressed,
  rightPressed,
  leftKey,
  rightKey,
) {
  if (player1.isAttacking || player1.isBlocking || player1.dead) return;
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

export async function determineDamage(player) {
  const avgSurface = 26759.23;
  const avgFramesCount = 8.1;
  if (!avgSurface || !avgFramesCount) {
    player.damage = 0;
    return;
  }
  const surface = ATTACKBOX_WIDTH * Math.abs(ATTACKBOX_HEIGHT);
  const framesCount = ATTACK_FRAMES;
  const calculatedDamage =
    5 / (surface / avgSurface) / (avgFramesCount / framesCount);
  player.damage = calculatedDamage > 10 ? 10 : calculatedDamage;
}

export function determineWinner(p1, p2) {
  if (p1.health > p2.health) {
    p2.dead = true;
  } else if (p1.health < p2.health) {
    p1.dead = true;
  } else {
    //tie
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
