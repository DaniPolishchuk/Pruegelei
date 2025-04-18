class Sprite {
    constructor({position, imageSrc, width = canvas.width, height = canvas.height, scale = 1}) {
        this.position = position;
        this.width = width;
        this.height = height;
        this.image = new Image();
        this.imageLoaded = false;
        this.scale = scale;
        this.image.onload = () => {
            this.imageLoaded = true;
        };

        this.image.src = imageSrc;
    }

    draw(ctxArg = ctx) {
        if (!this.imageLoaded) return;
        ctxArg.drawImage(
            this.image,
            this.position.x,
            this.position.y,
            this.width * this.scale,
            this.height * this.scale
        );
    }

    update(ctxArg = ctx) {
        this.draw(ctxArg);
    }
}

class Fighter {
    baseAttackBoxOffset;
    offset;
    sprites;
    constructor({position, velocity}) {
        this.position = position;
        this.currentSpriteName = 'idle';
        this.image = new Image();
        this.scale = 1;
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
        this.hitbox = {
            position: {
                x: this.position.x,
                y: this.position.y,
            },
            width: 100,
            height: this.height,
        };
        this.shield = new Sprite({
            position: {
                x: this.position.x,
                y: this.position.y,
            },
            imageSrc: "../Assets/Shield.png",
            width: 100,
            height: 100,
            scale: 2,
        });
    }

    draw(ctxArg = ctx) {
        const frameWidth = this.image.width / this.framesMax;
        const drawWidth = frameWidth * this.scale;
        const drawHeight = this.image.height * this.scale;
        const drawX = this.position.x - this.offset.x;
        const drawY = this.position.y - this.offset.y;

        if (this.flip) {
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
                drawHeight
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
                drawHeight
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
        }
    }

    update(ctxArg = ctx) {
        this.draw(ctxArg);

        this.framesElapsed++;

        if (!this.dead) {
            if (this.framesElapsed % this.framesHold === 0) {
                if (this.framesCurrent < this.framesMax - 1) {
                    this.framesCurrent++;
                } else {
                    this.framesCurrent = 0;
                }
            }
        }

        this.hitbox.position.x = this.position.x;
        this.hitbox.position.y = this.position.y;
        if (!this.flip) {
            this.attackBox.position.x = this.position.x + this.baseAttackBoxOffset.x;
        } else {
            this.attackBox.position.x = this.position.x - this.width + this.baseAttackBoxOffset.x - this.attackBox.width;
        }
        this.attackBox.position.y = this.position.y + this.baseAttackBoxOffset.y;

        /*
        ctxArg.fillRect(
            this.hitbox.position.x,
            this.hitbox.position.y,
            this.hitbox.width,
            this.hitbox.height);
        ctxArg.fillRect(
            this.attackBox.position.x,
            this.attackBox.position.y,
            this.attackBox.width,
            this.attackBox.height);4
         */
        if (this.isBlocking) {

            this.image = this.sprites.idle.image;
            this.framesMax = this.sprites.idle.framesMax;

            let playerMiddle = (this.position.x + this.position.x + this.width) / 2;
            this.shield.position = {
                x: this.flip ? playerMiddle - this.shield.width / 2 - 30 : this.position.x - 50,
                y: this.position.y,
            };
            this.shield.draw(ctxArg);
            this.switchSprite("idle");
            if (this.velocity.y > 0) {
                this.position.y += this.velocity.y;
            }
        } else {
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;

        }

        if (this.position.y + this.height + this.velocity.y > groundLvl) {
            this.velocity.y = 0;
        } else {
            this.velocity.y += gravity;
        }
    }

    takeHit(damage) {
        if (!this.isBlocking) {
            this.health -= damage;
            if (this.health <= 0) {
                this.switchSprite("death");
            } else {
                this.switchSprite("takeHit");
            }
        }
    }

    switchSprite(sprite) {
        if (this.image === this.sprites.death.image
            && this.framesCurrent === this.sprites.death.framesMax - 1) {
            this.dead = true;
            return;
        }

        // Prevent override if death animation ended
        if (this.image === this.sprites.death.image && this.framesCurrent === this.sprites.death.framesMax - 1) {
            this.dead = true;
            return;
        }

        // Prevent interrupting attack animations
        const attackKey = sprite;
        if (this.isAttacking && this.image === this.sprites[attackKey]?.image && this.framesCurrent < this.sprites[attackKey].framesMax - 1) {
            return;
        }

        // Prevent interrupting hit animations
        if (this.image === this.sprites.takeHit?.image && this.framesCurrent < this.sprites.takeHit.framesMax - 1) {
            return;
        }

        // Switch sprite
        if (this.sprites[sprite]) {
            this.image = this.sprites[sprite].image;
            this.framesMax = this.sprites[sprite].framesMax;
            this.framesCurrent = 0;
        }

        // Capture current sprite for networking
        this.currentSpriteName = sprite;
    }
}
