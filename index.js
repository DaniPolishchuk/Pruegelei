const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.overflow = "hidden";
document.body.style.margin = "0";
document.body.style.padding = "0";

ctx.fillRect(0, 0, canvas.width, canvas.height);

const gravity = 0.5;

class Sprite {
    constructor({position, velocity, color, offset}) {
        this.position = position;
        this.velocity = velocity;
        this.width = 50;
        this.height = 150;
        this.color = color;
        this.lastKey;
        this.attackBox = {
            position: {
                x: this.position.x,
                y: this.position.y
            },
            width: 100,
            height: 50,
            offset: offset
        };
        this.isAttacking = false;
        this.health = 100;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        // attack box
        if (this.isAttacking) {
            ctx.fillStyle = "white";
            ctx.fillRect(this.attackBox.position.x, this.attackBox.position.y, this.attackBox.width, this.attackBox.height);
        }

    }

    attack() {
        this.isAttacking = true;
        setTimeout(() => {
            this.isAttacking = false;
        }, 100)
    }

    update() {
        this.draw();

        this.attackBox.position.x = this.position.x - this.attackBox.offset.x;
        this.attackBox.position.y = this.position.y;

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        if (this.position.y + this.height + this.velocity.y > canvas.height) {
            this.velocity.y = 0;
        } else {
            this.velocity.y += gravity;
        }
    }
}

const player1 = new Sprite({
    position: {
        x: 0,
        y: 0,
    },
    velocity: {
        x: 0,
        y: 0,
    },
    color: "red",
    offset: {
        x: 0,
        y: 0,
    }
});

const player2 = new Sprite({
    position: {
        x: 400,
        y: 100,
    },
    velocity: {
        x: 0,
        y: 0,
    },
    color: "green",
    offset: {
        x: 50,
        y: 0,
    }
});

const keys = {
    a: {
        pressed: false
    },
    d: {
        pressed: false
    },
    ArrowLeft: {
        pressed: false
    },
    ArrowRight: {
        pressed: false
    }
};

function rectangularCollusion(rectangel1, rectangel2) {
    return (
        rectangel1.attackBox.position.x + rectangel1.attackBox.width >= rectangel2.position.x &&
        rectangel1.attackBox.position.x <= rectangel2.position.x + rectangel2.width &&
        rectangel1.attackBox.position.y + rectangel1.attackBox.height >= rectangel2.position.y &&
        rectangel1.attackBox.position.y <= rectangel2.position.y + rectangel2.height
    )
}

function decreaseTimer(){
    let timerValue = parseInt(document.getElementById("timer").textContent.trim());
    if (timerValue > 0) {
        setTimeout(decreaseTimer, 1000);
        timerValue--;
        document.getElementById("timer").textContent = String(timerValue);
    } else if (timerValue === 0) {
        document.querySelector("#gameResult").style.display = "flex";
        if (player1.health > player2.health) {
            document.querySelector("#gameResult").innerHTML = "Player 1 won";
        } else if (player1.health < player2.health) {
            document.querySelector("#gameResult").innerHTML = "Player 2 won";
        } else {
            document.querySelector("#gameResult").innerHTML = "Tie";
        }
    }
}

decreaseTimer()

function animate() {
    window.requestAnimationFrame(animate);  // what we want to loop over and over again
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    player1.update();
    player2.update();

    player1.velocity.x = 0;
    player2.velocity.x = 0;

    //player1 movements
    if (keys.a.pressed && player1.lastKey === "a") {
        player1.velocity.x = -5;
    } else if (keys.d.pressed && player1.lastKey === "d") {
        player1.velocity.x = 5;
    }

    //player2 movements
    if (keys.ArrowLeft.pressed && player2.lastKey === "ArrowLeft") {
        player2.velocity.x = -5;
    } else if (keys.ArrowRight.pressed && player2.lastKey === "ArrowRight") {
        player2.velocity.x = 5;
    }

    if (rectangularCollusion(player1, player2) && player1.isAttacking) {
        player1.isAttacking = false;
        player2.health -= 10;
        document.querySelector("#player2health").style.width = player2.health + "%";
    }

    if (rectangularCollusion(player2, player1) && player2.isAttacking) {
        player2.isAttacking = false;
        player1.health -= 10;
        document.querySelector("#player1health").style.width = player1.health + "%";
    }

}

animate();

window.addEventListener("keydown", (event) => {
    switch (event.key) {
        case 'd':
            keys.d.pressed = true;
            player1.lastKey = "d";
            break;
        case 'a':
            keys.a.pressed = true;
            player1.lastKey = "a";
            break;
        case 'w':
            player1.velocity.y = -20;
            break;
        case ' ':
            player1.attack();
            break;

        case 'ArrowLeft':
            keys.ArrowLeft.pressed = true;
            player2.lastKey = "ArrowLeft";
            break;
        case 'ArrowRight':
            keys.ArrowRight.pressed = true;
            player2.lastKey = "ArrowRight";
            break;
        case 'ArrowUp':
            player2.velocity.y = -20;
            break;
        case 'ArrowDown':
            player2.attack();
            break;
    }
});

window.addEventListener("keyup", (event) => {
    switch (event.key) {
        case 'd':
            keys.d.pressed = false;
            break;
        case 'a':
            keys.a.pressed = false;
            break;
        case 'w':
            break;
        case 'ArrowLeft':
            keys.ArrowLeft.pressed = false;
            break;
        case 'ArrowRight':
            keys.ArrowRight.pressed = false;
            break;
        case 'ArrowUp':
            break;
    }
});