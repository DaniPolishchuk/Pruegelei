function rectangularCollision(fighter1, fighter2) {
    const { position: pos1, width: boxWidth } = fighter1.attackBox;
    const right1 = pos1.x + boxWidth;
    const pos2x = fighter2.position.x;
    const fighter2Width = fighter2.width;

    return (
        right1 >= pos2x - fighter2Width &&
        pos1.x <= pos2x + fighter2Width
    );
}

function collisionLeft(player1, player2) {
    if(player1.position.x < player2.position.x + player2.width) {
        return (
            player1.position.x + player1.width < player2.position.x ||
            player1.position.y + player1.height < player2.position.y ||
            player1.position.y > player2.position.y + player2.height
        )
    } else {
        return true;
    }
}

function collisionRight(player1, player2) {
    if(player1.position.x > player2.position.x) {
        return (
            player1.position.x > player2.position.x + player2.width ||
            player1.position.y + player1.height < player2.position.y ||
            player1.position.y > player2.position.y + player2.height
        )
    } else {
        return true;
    }
}


function determineWinner(player1, player2, timerId) {
    clearTimeout(timerId);
    const gameResultEl = document.querySelector("#gameResult");
    gameResultEl.style.display = "flex";
    if (player1.health > player2.health) {
        gameResultEl.textContent = "Player 1 won";
    } else if (player1.health < player2.health) {
        gameResultEl.textContent = "Player 2 won";
    } else {
        gameResultEl.textContent = "Tie";
    }
    // Reload page after 3 seconds.
    setTimeout(() => location.reload(), 3000);
}

// ===== Timer Functions =====
let timerID;
let timerValue = parseInt(document.getElementById("timer").textContent.trim(), 10);

function decreaseTimer() {
    const timerEl = document.getElementById("timer");
    if (timerValue > 0) {
        timerValue--;
        timerEl.textContent = timerValue;
        timerID = setTimeout(decreaseTimer, 1000);
    } else {
        determineWinner(player1, player2, timerID);
    }
}

// ===== Data Fetching Functions =====
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

// ===== Fighter Data Setup =====
async function setFighterData(player, flip, fighterName) {
    try {
        // Fetch all fighters and pick the one matching fighterName.
        const fighters = await getFighters();
        const fighter = fighters.find(f => f.Name === fighterName);
        if (!fighter) {
            console.error(`Fighter "${fighterName}" not found.`);
            return;
        }

        // Basic player properties.
        player.scale = fighter.Scale;
        player.image.src = fighter.Idle;
        player.framesMax = fighter.IdleFrames;
        player.offset = { x: fighter.OffsetX, y: fighter.OffsetY };
        player.flip = flip;

        // Define and store the base attack box offset (assumes fighter is facing right).
        const baseAttackBoxOffset = { x: fighter.AttackBoxOffsetX, y: fighter.AttackBoxOffsetY };
        player.baseAttackBoxOffset = baseAttackBoxOffset;

        // Compute the attack box offset for the primary attack.
        // If not flipped, use the base offset.
        // If flipped, mirror it relative to the fighter.
        const attackBoxWidth = fighter.Attack1Width;
        const attackBoxOffsetX = flip
            ? baseAttackBoxOffset.x - attackBoxWidth
            : baseAttackBoxOffset.x;

        player.attackBox = {
            position: { x: player.position.x, y: player.position.y },
            offset: { x: attackBoxOffsetX, y: baseAttackBoxOffset.y },
            width: attackBoxWidth,
            height: fighter.Attack1Height,
        };
        player.attackFrames = fighter.Attack1Frames;

        // Helper to create an attack box for a given attack type using the base offset.
        const createAttackBox = (attackKey) => {
            const attackBoxWidth = fighter[attackKey + "Width"];
            const offsetX = flip
                ? player.width - baseAttackBoxOffset.x - attackBoxWidth
                : baseAttackBoxOffset.x;
            return {
                position: { x: player.position.x, y: player.position.y },
                offset: { x: offsetX, y: baseAttackBoxOffset.y },
                width: attackBoxWidth,
                height: fighter[attackKey + "Height"],
            };
        };

        // Mapping of sprite keys to fighter property keys.
        const spriteMapping = {
            idle:    { srcKey: "Idle",    framesKey: "IdleFrames" },
            run:     { srcKey: "Run",     framesKey: "RunFrames" },
            jump:    { srcKey: "Jump",    framesKey: "JumpFrames" },
            fall:    { srcKey: "Fall",    framesKey: "FallFrames" },
            attack1: { srcKey: "Attack1", framesKey: "Attack1Frames", hasAttackBox: true },
            attack2: { srcKey: "Attack2", framesKey: "Attack2Frames", hasAttackBox: true },
            attack3: { srcKey: "Attack3", framesKey: "Attack3Frames", hasAttackBox: true },
            attack4: { srcKey: "Attack4", framesKey: "Attack4Frames", hasAttackBox: true },
            takeHit: { srcKey: "TakeHit", framesKey: "TakeHitFrames" },
            death:   { srcKey: "Death",   framesKey: "DeathFrames" },
        };

        player.sprites = {};
        for (const [key, mapping] of Object.entries(spriteMapping)) {
            player.sprites[key] = {
                imageSrc: fighter[mapping.srcKey],
                framesMax: fighter[mapping.framesKey],
            };
            if (mapping.hasAttackBox) {
                player.sprites[key].attackBox = createAttackBox(mapping.srcKey);
            }
        }

        // Preload images for each sprite.
        for (const spriteKey in player.sprites) {
            const sprite = player.sprites[spriteKey];
            sprite.image = new Image();
            sprite.image.src = sprite.imageSrc;
        }
    } catch (error) {
        console.error("Error fetching fighter data:", error);
    }
}


