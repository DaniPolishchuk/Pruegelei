function rectangularCollusion(fighter1, fighter2, enemyIsRight) {
    if (enemyIsRight) {
        return (fighter1.attackBox.position.x + fighter1.attackBox.width >= fighter2.position.x - fighter2.width &&
            fighter1.attackBox.position.x <= fighter2.position.x + fighter2.width);
    } else {
        return (fighter1.attackBox.position.x + fighter1.attackBox.width <= fighter2.position.x + fighter2.width &&
            fighter1.attackBox.position.x >= fighter2.position.x + fighter2.width);
    }
}

function determineWinner(player1, player2, timerId) {
    clearTimeout(timerId);
    document.querySelector("#gameResult").style.display = "flex";
    if (player1.health > player2.health) {
        document.querySelector("#gameResult").innerHTML = "Player 1 won";
    } else if (player1.health < player2.health) {
        document.querySelector("#gameResult").innerHTML = "Player 2 won";
    } else {
        document.querySelector("#gameResult").innerHTML = "Tie";
    }
    setTimeout(() => {
        location.reload();
    }, 1500);
}

let timerID;

function decreaseTimer() {
    let timerValue = parseInt(document.getElementById("timer").textContent.trim());
    if (timerValue > 0) {
        timerID = setTimeout(decreaseTimer, 1000);
        timerValue--;
        document.getElementById("timer").textContent = String(timerValue);
    } else if (timerValue === 0) {
        determineWinner(player1, player2);
    }
}

async function getFighters() {
    try {
        const response = await fetch("http://127.0.0.1:5001/fighters");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching fighters:", error);
        return [];
    }
}

async function setFighterData(player, flip, fighterName) {
    try {
        // Fetch all fighters from the API
        const fighters = await getFighters();

        // Find the fighter by name
        const fighter = fighters.find(f => f.Name === fighterName);

        if (!fighter) {
            console.error(`Fighter "${fighterName}" not found.`);
            return;
        }

        // Set player properties from database
        player.scale = fighter.Scale;
        player.image.src = fighter.Idle;
        player.framesMax = fighter.IdleFrames;
        player.offset = {
            x: fighter.OffsetX,
            y: fighter.OffsetY
        };
        player.flip = flip;

        // Attack box position adjustment based on flip state
        const attackBoxOffsetX = flip ? -100 : 100;
        const attackBoxOffsetY = 50;
        const flipped = flip ? -1 : 1;
        player.attackBox = {
            position: {x: player.position.x, y: player.position.y},
            offset: {x: attackBoxOffsetX, y: attackBoxOffsetY},
            width: fighter.Attack1Width * flipped,
            height: fighter.Attack1Height * flipped,
        };
        player.attackFrames = fighter.Attack1.Attack1Frames;

        // Set fighter sprites
        player.sprites = {
            idle: {imageSrc: fighter.Idle, framesMax: fighter.IdleFrames},
            run: {imageSrc: fighter.Run, framesMax: fighter.RunFrames},
            jump: {imageSrc: fighter.Jump, framesMax: fighter.JumpFrames},
            fall: {imageSrc: fighter.Fall, framesMax: fighter.FallFrames},
            attack1: {
                imageSrc: fighter.Attack1,
                framesMax: fighter.Attack1Frames,
                attackBox: {
                    position: {x: player.position.x, y: player.position.y},
                    offset: {x: attackBoxOffsetX, y: attackBoxOffsetY},
                    width: fighter.Attack1Width * flipped,
                    height: fighter.Attack1Height * flipped,
                }
            },
            attack2: {
                imageSrc: fighter.Attack2,
                framesMax: fighter.Attack2Frames,
                attackBox: {
                    position: {x: player.position.x, y: player.position.y},
                    offset: {x: attackBoxOffsetX, y: attackBoxOffsetY},
                    width: fighter.Attack2Width * flipped,
                    height: fighter.Attack2Height * flipped,
                }
            },
            attack3: {
                imageSrc: fighter.Attack3,
                framesMax: fighter.Attack3Frames,
                attackBox: {
                    position: {x: player.position.x, y: player.position.y},
                    offset: {x: attackBoxOffsetX, y: attackBoxOffsetY},
                    width: fighter.Attack3Width * flipped,
                    height: fighter.Attack3Height * flipped,
                }
            },
            attack4: {
                imageSrc: fighter.Attack4,
                framesMax: fighter.Attack4Frames,
                attackBox: {
                    position: {x: player.position.x, y: player.position.y},
                    offset: {x: attackBoxOffsetX, y: attackBoxOffsetY},
                    width: fighter.Attack4Width * flipped,
                    height: fighter.Attack4Height * flipped,
                }
            },
            takeHit: {imageSrc: fighter.TakeHit, framesMax: fighter.TakeHitFrames},
            death: {imageSrc: fighter.Death, framesMax: fighter.DeathFrames}
        };

        // Load images for each sprite
        for (const sprite in player.sprites) {
            player.sprites[sprite].image = new Image();
            player.sprites[sprite].image.src = player.sprites[sprite].imageSrc;
        }
    } catch (error) {
        console.error("Error fetching fighter data:", error);
    }
}