// ==========================
// Imports
// ==========================
import { SoundEffect } from "./utils.js";

// ==========================
// Sprite class: base renderable object
// ==========================
export class Sprite {
  constructor({ position, imageSrc, width, height, scale = 1 }) {
    this.position = position;
    this.width = width;
    this.height = height;
    this.image = new Image();
    this.imageLoaded = false;
    this.scale = scale;
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    this.image.onload = () => {
      this.imageLoaded = true;
    };
    this.image.src = imageSrc;
  }

  draw(ctxArg, flip = false) {
    if (!this.imageLoaded) return;
    ctxArg.save();
    if (flip) {
      ctxArg.scale(-1, 1);
      ctxArg.drawImage(
        this.image,
        -(this.position.x + this.width * this.scale),
        this.position.y,
        this.width * this.scale,
        this.height * this.scale,
      );
    } else {
      ctxArg.drawImage(
        this.image,
        this.position.x,
        this.position.y,
        this.width * this.scale,
        this.height * this.scale,
      );
    }
    ctxArg.restore();
  }

  update(ctxArg) {
    this.draw(ctxArg);
  }
}

// ==========================
// Fighter class: full player logic and animation
// ==========================
export class Fighter {
  constructor({ position, velocity, canvas }) {
    this.position = position;
    this.currentSpriteName = "idle";
    this.image = new Image();
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 7;
    this.isBlocking = false;
    this.velocity = velocity;
    this.width = canvas.width / 23;
    this.height = canvas.height / 5;
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
    this.shield = new Sprite({
      position: { x: this.position.x, y: this.position.y },
      imageSrc: "/Assets/Shield/image.png",
      width: 100,
      height: 100,
      scale: 2,
    });
  }

  draw(ctxArg, flip) {
    const frameWidth = this.image.width / this.framesMax;
    const drawWidth = frameWidth * this.scale;
    const drawHeight = this.image.height * this.scale;
    const drawX = this.position.x - this.offset.x;
    const drawY = this.position.y - this.offset.y;

    if (flip) {
      ctxArg.save();
      ctxArg.scale(-1, 1);
      ctxArg.drawImage(
        this.image,
        this.framesCurrent * frameWidth,
        0,
        frameWidth,
        this.image.height,
        -(drawX + drawWidth),
        drawY,
        drawWidth,
        drawHeight,
      );
      ctxArg.restore();
    } else {
      ctxArg.drawImage(
        this.image,
        this.framesCurrent * frameWidth,
        0,
        frameWidth,
        this.image.height,
        drawX,
        drawY,
        drawWidth,
        drawHeight,
      );
    }
  }

  attack() {
    if (!this.isBlocking) {
      switch (this.attackStyle) {
        case "style1":
          this.switchSprite("attack1", "style1");
          break;
        case "style2":
          this.switchSprite("attack2", "style2");
          break;
        case "style3":
          this.switchSprite("attack3", "style3");
          break;
        case "style4":
          this.switchSprite("attack4", "style4");
          break;
      }
      this.isAttacking = true;
      this.hitLanded = false;
    }
  }

  update(ctxArg, groundLvl, gravity) {
    // Draw the current frame of the fighter
    this.draw(ctxArg, this.flip);

    // Increment the frame counter for sprite animation
    this.framesElapsed++;

    // Apply gravity and handle ground collision
    if (this.position.y + this.height + this.velocity.y > groundLvl) {
      // If on or below ground level, stop vertical movement
      this.velocity.y = 0;
      this.position.y += this.velocity.y;
    } else {
      // If in the air, apply gravity and update vertical position
      this.velocity.y += gravity;
      this.position.y += this.velocity.y;
    }

    // If the fighter is not dead, update horizontal position
    if (!this.dead) this.position.x += this.velocity.x;

    // Handle "death" animation
    if (this.currentSpriteName === "death") {
      if (this.framesElapsed % this.framesHold === 0) {
        // Advance frame until animation ends
        if (this.framesCurrent < this.framesMax - 1) {
          this.framesCurrent++;
        } else {
          // Mark as dead once final frame is reached
          this.dead = true;
        }
      }
      return;
    }

    // Handle "takeHit" animation
    if (this.currentSpriteName === "takeHit") {
      if (this.framesElapsed % this.framesHold === 0) {
        // Advance frame or switch back to idle after hit animation
        if (this.framesCurrent < this.framesMax - 1) {
          this.framesCurrent++;
        } else {
          this.switchSprite("idle");
        }
      }
      return;
    }

    // Advance sprite animation for regular actions (e.g. idle, run)
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) {
        this.framesCurrent++;
      } else {
        // Loop animation or stop attack animation
        this.framesCurrent = 0;
        if (this.isAttacking) this.isAttacking = false;
      }
    }

    // Sync hitbox position with fighter's current position
    this.hitbox.position.x = this.position.x;
    this.hitbox.position.y = this.position.y;

    // Update attack box position depending on whether fighter is flipped
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

    // If blocking, show shield and lock to position
    if (this.isBlocking) {
      if (this.sprites.block.image) {
        this.switchSprite("block");
      } else {
        // If no blocking sprite, simulate shield manually
        this.isBlocking = false;
        this.switchSprite("idle");
        this.isBlocking = true;

        let playerMiddle = this.position.x + this.width / 2;
        this.shield.position = {
          x: this.flip
            ? playerMiddle - this.shield.width / 2 - 50
            : this.position.x - 50,
          y: this.position.y - 25,
        };

        // Draw shield sprite
        this.shield.draw(ctxArg, this.flip);
      }

      // Ensure vertical movement continues during block
      if (this.velocity.y > 0) {
        this.position.y += this.velocity.y;
      }
    }
  }

  takeHit(damage) {
    if (this.isBlocking || this.dead) return;
    this.health = Math.max(this.health - damage, 0);
    SoundEffect(`/Assets/OuchSound/${this.gender}/sound.bin`).play();
    if (this.health === 0) {
      this.switchSprite("death");
    } else {
      this.switchSprite("takeHit");
    }
  }

  switchSprite(sprite) {
    if (this.currentSpriteName === "death" && this.dead) return;
    if (sprite === "death") {
      this.currentSpriteName = "death";
      if (this.image !== this.sprites.death.image) {
        this.image = this.sprites.death.image;
        this.framesMax = this.sprites.death.framesMax;
        this.framesCurrent = 0;
      }
      return;
    }
    if (this.currentSpriteName === "death") return;
    if (
      sprite === "takeHit" &&
      this.currentSpriteName === "takeHit" &&
      this.framesCurrent < this.sprites.takeHit.framesMax - 1
    ) {
      return;
    }

    switch (this.attackStyle) {
      case "style1":
        if (
          this.image === this.sprites.attack1.image &&
          this.framesCurrent < this.sprites.attack1.framesMax - 1
        )
          return;
        break;
      case "style2":
        if (
          this.image === this.sprites.attack2.image &&
          this.framesCurrent < this.sprites.attack2.framesMax - 1
        )
          return;
        break;
      case "style3":
        if (
          this.image === this.sprites.attack3.image &&
          this.framesCurrent < this.sprites.attack3.framesMax - 1
        )
          return;
        break;
      case "style4":
        if (
          this.image === this.sprites.attack4.image &&
          this.framesCurrent < this.sprites.attack4.framesMax - 1
        )
          return;
        break;
    }

    this.currentSpriteName = sprite;
    if (!this.isBlocking || sprite === "block") {
      switch (sprite) {
        case "idle":
          if (this.image !== this.sprites.idle.image) {
            this.image = this.sprites.idle.image;
            this.framesMax = this.sprites.idle.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "run":
          if (this.image !== this.sprites.run.image) {
            this.image = this.sprites.run.image;
            this.framesMax = this.sprites.run.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "jump":
          if (this.image !== this.sprites.jump.image) {
            this.image = this.sprites.jump.image;
            this.framesMax = this.sprites.jump.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "fall":
          if (this.image !== this.sprites.fall.image) {
            this.image = this.sprites.fall.image;
            this.framesMax = this.sprites.fall.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "attack1":
          this.image = this.sprites.attack1.image;
          this.framesMax = this.sprites.attack1.framesMax;
          this.framesCurrent = 0;
          break;
        case "attack2":
          this.image = this.sprites.attack2.image;
          this.framesMax = this.sprites.attack2.framesMax;
          this.framesCurrent = 0;
          break;
        case "attack3":
          this.image = this.sprites.attack3.image;
          this.framesMax = this.sprites.attack3.framesMax;
          this.framesCurrent = 0;
          break;
        case "attack4":
          this.image = this.sprites.attack4.image;
          this.framesMax = this.sprites.attack4.framesMax;
          this.framesCurrent = 0;
          break;
        case "takeHit":
          if (this.image !== this.sprites.takeHit.image) {
            this.image = this.sprites.takeHit.image;
            this.framesMax = this.sprites.takeHit.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "death":
          if (this.image !== this.sprites.death.image) {
            this.image = this.sprites.death.image;
            this.framesMax = this.sprites.death.framesMax;
            this.framesCurrent = 0;
          }
          break;
        case "block":
          if (this.image !== this.sprites.block.image) {
            this.image = this.sprites.block.image;
            this.framesMax = this.sprites.block.framesMax;
            this.framesCurrent = 0;
          }
          break;
      }
    }
  }
}

// ==========================
// MiniFighter class: used in selection screen previews
// ==========================
export class MiniFighter {
  constructor(canvas, idle, scale, idleFrames, offset) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.image = new Image();
    this.image.onload = () => (this.loaded = true);
    this.image.onerror = () => (this.loaded = false);
    this.loaded = false;
    this.setImage(idle);
    this.scale = scale || 0;
    this.framesMax = idleFrames || 0;
    this.framesCurrent = 0;
    this.framesElapsed = 0;
    this.framesHold = 7;
    this.offset = offset || { x: 0, y: 0 };
    this.flipped = false;
    this.name = null;
  }

  setImage(idle) {
    if (idle) {
      this.loaded = false;
      this.image.src = idle;
    } else {
      this.image.src = "";
      this.loaded = false;
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.loaded && this.image.src) {
      const frameWidth = this.image.width / this.framesMax;
      const drawWidth = frameWidth * this.scale;
      const drawHeight = this.image.height * this.scale;
      const drawX = -this.offset.x;
      const drawY = -this.offset.y;
      if (this.flipped) {
        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(
          this.image,
          this.framesCurrent * frameWidth,
          0,
          frameWidth,
          this.image.height,
          -(drawX + drawWidth),
          drawY,
          drawWidth,
          drawHeight,
        );
        this.ctx.restore();
      } else {
        this.ctx.drawImage(
          this.image,
          this.framesCurrent * frameWidth,
          0,
          frameWidth,
          this.image.height,
          drawX,
          drawY,
          drawWidth,
          drawHeight,
        );
      }
    }
  }

  update() {
    this.draw();
    this.framesElapsed++;
    if (this.framesElapsed % this.framesHold === 0) {
      if (this.framesCurrent < this.framesMax - 1) {
        this.framesCurrent++;
      } else {
        this.framesCurrent = 0;
      }
    }
  }
}
