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
        this.framesHold = 7;
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
        this.framesElapsed++

        if (this.framesElapsed % this.framesHold === 0) {
            if (this.framesCurrent < this.framesMax - 1) {
                this.framesCurrent++;
            } else {
                this.framesCurrent = 0;
            }
        }
        this.attackBox.position.x = this.position.x + this.attackBox.offset.x;
        this.attackBox.position.y = this.position.y + this.attackBox.offset.y;
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

    switchSprite(sprite) {
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
            case'attack4':
                this.image = this.sprites.attack4.image;
                this.framesMax = this.sprites.attack4.framesMax;
                this.framesCurrent = 0;
                break;
        }
    }
}
