import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./gameLogic.js";

export class Fighter {
  constructor({ position, velocity }) {
    this.position = position;
    this.currentSpriteName = "idle";
    this.image = {
      width: 0,
      height: 0,
    };
    this.blocked = false;
    this.scale = 1;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 7;
    this.isBlocking = false;
    this.velocity = velocity;
    this.width = CANVAS_WIDTH / 23;
    this.height = CANVAS_HEIGHT / 5;
    this.damage = 5;
    this.attackStyle = "style1";
    this.health = 100;
    this.dead = false;
    this.isAttacking = false;
    this.hitbox = {
      position: {
        x: this.position.x,
        y: this.position.y,
      },
      width: 100,
      height: this.height,
    };
    this.shield = null;
  }
  attack() {
    if (!this.isBlocking) {
      this.isAttacking = true;
      this.hitLanded = false;
    }
  }

  update(groundLvl, gravity) {
    this.framesElapsed++;
    this.blocked = false;
    this.hitLanded = false;

    if (this.position.y + this.height + this.velocity.y > groundLvl) {
      this.velocity.y = 0;
      this.position.y += this.velocity.y;
    } else {
      this.velocity.y += gravity;
      this.position.y += this.velocity.y;
    }
    if (!this.dead) this.position.x += this.velocity.x;

    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) {
        this.framesCurrent++;
      } else {
        this.framesCurrent = 0;
        if (this.isAttacking) this.isAttacking = false;
        if (this.isBlocking) this.isBlocking = false;
      }
    }

    this.hitbox.position.x = this.position.x;
    this.hitbox.position.y = this.position.y;
    if (!this.flip) {
      this.attackBox.position.x = this.position.x + this.baseAttackBoxOffset.x;
    } else {
      this.attackBox.position.x =
        this.position.x +
        this.width -
        this.baseAttackBoxOffset.x -
        this.attackBox.width;
    }
    this.attackBox.position.y = this.position.y + this.baseAttackBoxOffset.y;

    if (this.isBlocking) {
      if (this.velocity.y > 0) {
        this.position.y += this.velocity.y;
      }
    }
  }

  takeHit(damage) {
    if (this.isBlocking || this.dead) {
      this.blocked = true;
      return;
    }
    this.health = Math.max(this.health - damage, 0);
    this.hitLanded = true;
    if (this.health === 0) {
      this.dead = true;
    }
  }
}

export async function setFighterData(player, flip) {
  try {
    player.scale = 3.0;
    player.offset = { x: 200, y: 140 };
    player.flip = flip;
    player.health = 100;
    player.velocity = { x: 0, y: 0 };
    player.dead = false;
    if (flip) {
      player.position = {
        x: Math.random() * CANVAS_WIDTH,
        y: CANVAS_HEIGHT / 5,
      };
    } else {
      player.position = {
        x: Math.random() * CANVAS_WIDTH,
        y: CANVAS_HEIGHT / 5,
      };
    }
    const baseAttackBoxOffset = {
      x: 70,
      y: 120,
    };
    player.baseAttackBoxOffset = baseAttackBoxOffset;

    const attackBoxWidth = 120;
    const attackBoxOffsetX = flip
      ? baseAttackBoxOffset.x - attackBoxWidth
      : baseAttackBoxOffset.x;

    player.attackBox = {
      position: { x: player.position.x, y: player.position.y },
      offset: { x: attackBoxOffsetX, y: baseAttackBoxOffset.y },
      width: attackBoxWidth,
      height: -100,
    };
  } catch (error) {
    console.error("Error fetching fighter data:", error);
  }
}
