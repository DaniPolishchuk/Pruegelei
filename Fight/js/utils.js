// === Collision & Outcome ===
export function rectangularCollision(f1, f2) {
    const { position: p1, width: w1, height: h1 } = f1.attackBox;
    const left1 = p1.x, right1 = p1.x + w1;
    const top1 = Math.min(p1.y, p1.y + h1), bottom1 = Math.max(p1.y, p1.y + h1);
    const left2 = f2.position.x, right2 = f2.position.x + f2.width;
    const top2 = f2.position.y, bottom2 = f2.position.y + f2.height;

    return right1 >= left2 &&
        left1 <= right2 &&
        bottom1 >= top2 &&
        top1 <= bottom2;
}

export function determineWinner(p1, p2) {
    clearTimeout(timerID);
    const resEl = document.querySelector("#gameResult");
    resEl.style.display = "flex";
    if (p1.health > p2.health) resEl.textContent = "Player1 won";
    else if (p1.health < p2.health) resEl.textContent = "Player2 won";
    else resEl.textContent = "Tie";
}

// === Timer ===
const timerEl = document.getElementById("timer");
let timerValue = timerEl ? parseInt(timerEl.textContent, 10) : null;
let timerID;
export function decreaseTimer() {
    const el = document.getElementById("timer");
    if (timerValue > 0) {
        timerValue--;
        el.textContent = timerValue;
        timerID = setTimeout(decreaseTimer, 1000);
    } else {
        determineWinner(player1, player2, timerID);
    }
}

// === Data Fetching ===
export async function getFighters() {
    try {
        const response = await fetch("/fighters");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching fighters:", error);
        return [];
    }
}

export async function getBackgrounds() {
    try {
        const response = await fetch("/backgrounds");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching backgrounds:", error);
        return [];
    }
}

// === Fighter Data Setup ===
export async function setFighterData(player, flip, fighterName) {
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
        player.offset = {x: fighter.OffsetX, y: fighter.OffsetY};
        player.flip = flip;

        // Define and store the base attack box offset (assumes fighter is facing right).
        const baseAttackBoxOffset = {x: fighter.AttackBoxOffsetX, y: fighter.AttackBoxOffsetY};
        player.baseAttackBoxOffset = baseAttackBoxOffset;

        // Compute the attack box offset for the primary attack.
        // If not flipped, use the base offset.
        // If flipped, mirror it relative to the fighter.
        const attackBoxWidth = fighter.Attack1Width;
        const attackBoxOffsetX = flip
            ? baseAttackBoxOffset.x - attackBoxWidth
            : baseAttackBoxOffset.x;

        player.attackBox = {
            position: {x: player.position.x, y: player.position.y},
            offset: {x: attackBoxOffsetX, y: baseAttackBoxOffset.y},
            width: attackBoxWidth,
            height: fighter.Attack1Height,
        };
        player.attackFrames = fighter.Attack1Frames;

        // Helper to create an attack box for a given attack type using the base offset.
        const createAttackBox = (attackKey) => {
            const attackBoxWidth = fighter[attackKey + "Width"];
            const attackBoxHeight = fighter[attackKey + "Height"];
            const offsetX = flip
                ? player.width - baseAttackBoxOffset.x - attackBoxWidth
                : baseAttackBoxOffset.x;
            return {
                position: {x: player.position.x, y: player.position.y},
                offset: {x: offsetX, y: baseAttackBoxOffset.y},
                width: attackBoxWidth,
                height: attackBoxHeight,
            };
        };

        // Mapping of sprite keys to fighter property keys.
        const spriteMapping = {
            idle: {srcKey: "Idle", framesKey: "IdleFrames"},
            run: {srcKey: "Run", framesKey: "RunFrames"},
            jump: {srcKey: "Jump", framesKey: "JumpFrames"},
            fall: {srcKey: "Fall", framesKey: "FallFrames"},
            attack1: {srcKey: "Attack1", framesKey: "Attack1Frames", hasAttackBox: true},
            attack2: {srcKey: "Attack2", framesKey: "Attack2Frames", hasAttackBox: true},
            attack3: {srcKey: "Attack3", framesKey: "Attack3Frames", hasAttackBox: true},
            attack4: {srcKey: "Attack4", framesKey: "Attack4Frames", hasAttackBox: true},
            takeHit: {srcKey: "TakeHit", framesKey: "TakeHitFrames"},
            death: {srcKey: "Death", framesKey: "DeathFrames"},
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

// === Background Data Setup ===
export async function setBackground(bgName) {
    const backgrounds = await getBackgrounds();
    const background = backgrounds.find(f => f.Name === bgName);
    return {
        imageSrc: background.BackgroundImage,
        groundLevel: 720 / background.GroundLevel,
        borderBackground: background.BorderBackground
    };
}
// === Damage calculation helpers ===
async function getAvgAttackSurface() {
    const fighters = await getFighters();
    let totalSurface = 0, count = 0;

    function add(h, w) {
        totalSurface += Math.abs(h) * w;
        count++;
    }

    fighters.forEach(f => {
        add(f.Attack1Height, f.Attack1Width);
        if (f.Attack2 && f.Attack2 !== f.Attack1) add(f.Attack2Height, f.Attack2Width);
        if (f.Attack3 && f.Attack3 !== f.Attack2) add(f.Attack3Height, f.Attack3Width);
        if (f.Attack4 && f.Attack4 !== f.Attack3) add(f.Attack4Height, f.Attack4Width);
    });

    return count ? totalSurface / count : 0;
}

export async function determineDamage(player) {
    const avg = await getAvgAttackSurface();
    if (!avg) {
        player.damage = 0;
        return;
    }
    const surface = player.attackBox.width * Math.abs(player.attackBox.height);
    player.damage = 5 / (surface / avg);
}
