const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.style.overflow = "hidden";
document.body.style.margin = "0";
document.body.style.padding = "0";

ctx.fillRect(0, 0, canvas.width, canvas.height);

const gravity = 0.5;

const background = new Sprite({
    position: {
        x: 0,
        y: 0,
    },
    imageSrc: "./Backgrounds/Background1.png"
})

const player1 = new Fighter({
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

const player2 = new Fighter({
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

decreaseTimer()

function animate() {
    window.requestAnimationFrame(animate);  // what we want to loop over and over again
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    background.update();

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

    if (player2.health <= 0 || player1.health <= 0) {
         determineWinner(player1, player2, timerID);
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