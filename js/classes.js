class Sprite {
    constructor({position, imageSrc}) {
        this.position = position;
        this.width = canvas.width;
        this.height = canvas.height;
        this.image = new Image();
        this.image.src = imageSrc;
    }

    draw() {
        ctx.drawImage(this.image, this.position.x, this.position.y, this.width, this.height);
    }

    update() {
        this.draw();
    }
}

class Fighter {
    constructor({position, velocity}) {
        this.position = position;
        this.image = new Image();
        this.scale;
        this.framesMax;
        this.framesCurrent = 0;
        this.framesElapsed = 0;
        this.framesHold = 5;
        this.attackBox;
        this.attackFrames;
        this.velocity = velocity;
        this.width = canvas.width / 23;
        this.height = canvas.height / 5;
        this.lastKey;
        this.attackStyle = "style1";
        this.offset;
        this.sprites;
        this.isAttacking = false;
        this.health = 100;
        this.flip;
        this.dead = false;
    }

    draw() {
        const frameWidth = this.image.width / this.framesMax;
        const drawWidth = frameWidth * this.scale;
        const drawHeight = this.image.height * this.scale;
        const drawX = this.position.x - this.offset.x;
        const drawY = this.position.y - this.offset.y;

        if (this.flip) {
            ctx.save();
            // Flip the context horizontally.
            ctx.scale(-1, 1);
            // When flipped, x becomes negative.
            ctx.drawImage(
                this.image,
                this.framesCurrent * frameWidth,
                0,
                frameWidth,
                this.image.height,
                -(drawX + drawWidth),
                drawY,
                drawWidth,
                drawHeight
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                this.image,
                this.framesCurrent * frameWidth,
                0,
                frameWidth,
                this.image.height,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );
        }
    }


    attack() {
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
    }

    update() {
        this.draw();
        if (!this.dead){
            this.framesElapsed++

            if (this.framesElapsed % this.framesHold === 0) {
                if (this.framesCurrent < this.framesMax - 1) {
                    this.framesCurrent++;
                } else {
                    this.framesCurrent = 0;
                }
            }
        }
        if (!this.flip) {
            this.attackBox.position.x = this.position.x + this.baseAttackBoxOffset.x;
        } else {
            this.attackBox.position.x = this.position.x  - this.width + this.baseAttackBoxOffset.x - this.attackBox.width;
        }
        this.attackBox.position.y = this.position.y + this.baseAttackBoxOffset.y;
        /*
        ctx.fillRect(
            this.attackBox.position.x,
            this.attackBox.position.y,
            this.attackBox.width,
            this.attackBox.height);

         */

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        if (this.position.y + this.height + this.velocity.y > canvas.height / 1.187) {
            this.velocity.y = 0;
            //this.position.y = 553;
        } else {
            this.velocity.y += gravity;
        }
    }

    takeHit() {
        this.health -= 10;

        if (this.health <= 0) {
            this.switchSprite("death");
        } else {
            this.switchSprite("takeHit");
        }
    }

    switchSprite(sprite) {
        // override animations with death animation
        if (this.image === this.sprites.death.image) {
            if (this.framesCurrent === this.sprites.death.framesMax - 1) {
                this.dead = true;
            }
            return;
        }

        // override animations with attack animations
        switch (this.attackStyle) {
            case "style1":
                if (this.image === this.sprites.attack1.image && this.framesCurrent < this.sprites.attack1.framesMax - 1)
                    return;
                break;
            case "style2":
                if (this.image === this.sprites.attack2.image && this.framesCurrent < this.sprites.attack2.framesMax - 1)
                    return;
                break;
            case "style3":
                if (this.image === this.sprites.attack3.image && this.framesCurrent < this.sprites.attack3.framesMax - 1)
                    return;
                break;
            case "style4":
                if (this.image === this.sprites.attack4.image && this.framesCurrent < this.sprites.attack4.framesMax - 1)
                    return;
                break;
        }

        // override animations with take hit animations
        if (this.image === this.sprites.takeHit.image && this.framesCurrent < this.sprites.takeHit.framesMax - 1) {
            return;
        }

        switch (sprite) {
            case 'idle':
                if (this.image !== this.sprites.idle.image) {
                    this.image = this.sprites.idle.image;
                    this.framesMax = this.sprites.idle.framesMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'run':
                if (this.image !== this.sprites.run.image) {
                    this.image = this.sprites.run.image;
                    this.framesMax = this.sprites.run.framesMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'jump':
                if (this.image !== this.sprites.jump.image) {
                    this.image = this.sprites.jump.image;
                    this.framesMax = this.sprites.jump.framesMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'fall':
                if (this.image !== this.sprites.fall.image) {
                    this.image = this.sprites.fall.image;
                    this.framesMax = this.sprites.fall.framesMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'attack1':
                this.image = this.sprites.attack1.image;
                this.framesMax = this.sprites.attack1.framesMax;
                this.framesCurrent = 0;
                break;
            case 'attack2':
                this.image = this.sprites.attack2.image;
                this.framesMax = this.sprites.attack2.framesMax;
                this.framesCurrent = 0;
                break;
            case 'attack3':
                this.image = this.sprites.attack3.image;
                this.framesMax = this.sprites.attack3.framesMax;
                this.framesCurrent = 0;
                break;
            case 'attack4':
                this.image = this.sprites.attack4.image;
                this.framesMax = this.sprites.attack4.framesMax;
                this.framesCurrent = 0;
                break;
            case 'takeHit':
                if (this.image !== this.sprites.takeHit.image) {
                    this.image = this.sprites.takeHit.image;
                    this.framesMax = this.sprites.takeHit.framesMax;
                    this.framesCurrent = 0;
                }
                break;
            case 'death':
                if (this.image !== this.sprites.death.image) {
                    this.image = this.sprites.death.image;
                    this.framesMax = this.sprites.death.framesMax;
                    this.framesCurrent = 0;
                }
                break;
        }
    }
}
