// Fight/js/utils.js

// === Collision & Outcome ===
function rectangularCollision(f1, f2) {
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

function determineWinner(p1, p2, timerId) {
    clearTimeout(timerId);
    const resEl = document.querySelector("#gameResult");
    resEl.style.display = "flex";
    if (p1.health > p2.health) resEl.textContent = "Player 1 won";
    else if (p1.health < p2.health) resEl.textContent = "Player 2 won";
    else resEl.textContent = "Tie";
}

// === Timer ===
let _timerValue = parseInt(document.getElementById("timer").textContent, 10);
let _timerID;
function decreaseTimer() {
    const el = document.getElementById("timer");
    if (_timerValue > 0) {
        _timerValue--;
        el.textContent = _timerValue;
        _timerID = setTimeout(decreaseTimer, 1000);
    } else {
        determineWinner(player1, player2, _timerID);
    }
}

// === Data Fetching ===
async function getFighters() {
    try {
        const r = await fetch("/fighters");
        if (!r.ok) throw new Error(r.status);
        return await r.json();
    } catch (e) {
        console.error("getFighters()", e);
        return [];
    }
}

async function getBackgrounds() {
    try {
        const r = await fetch("/backgrounds");
        if (!r.ok) throw new Error(r.status);
        return await r.json();
    } catch (e) {
        console.error("getBackgrounds()", e);
        return [];
    }
}

// === Fighter Data Setup ===
async function setFighterData(player, flip, name) {
    const list = await getFighters();
    const f = list.find(x => x.Name === name);
    if (!f) return console.error("no fighter:", name);

    player.scale = f.Scale;
    player.image.src = f.Idle;
    player.framesMax = f.IdleFrames;
    player.offset = { x: f.OffsetX, y: f.OffsetY };
    player.flip = flip;

    // base attack‐box offset
    const baseOff = { x: f.AttackBoxOffsetX, y: f.AttackBoxOffsetY };
    player.baseAttackBoxOffset = baseOff;

    // primary attack1
    const w1 = f.Attack1Width, h1 = f.Attack1Height;
    player.attackBox = {
        position: { x: player.position.x, y: player.position.y },
        offset: { x: flip ? baseOff.x - w1 : baseOff.x, y: baseOff.y },
        width: w1, height: h1
    };
    player.attackFrames = f.Attack1Frames;

    // build sprites map
    const map = {
        idle: ["Idle", "IdleFrames"],
        run: ["Run", "RunFrames"],
        jump: ["Jump", "JumpFrames"],
        fall: ["Fall", "FallFrames"],
        takeHit: ["TakeHit", "TakeHitFrames"],
        death: ["Death", "DeathFrames"],
        attack1: ["Attack1", "Attack1Frames", true],
        attack2: ["Attack2", "Attack2Frames", true],
        attack3: ["Attack3", "Attack3Frames", true],
        attack4: ["Attack4", "Attack4Frames", true],
    };

    player.sprites = {};
    for (let [key, arr] of Object.entries(map)) {
        const [srcK, frK, hasBox] = arr;
        const imgSrc = f[srcK], fm = f[frK];
        player.sprites[key] = { imageSrc: imgSrc, framesMax: fm };
        if (hasBox) {
            const w = f[srcK + "Width"], h = f[srcK + "Height"];
            const xo = flip
                ? player.width - baseOff.x - w
                : baseOff.x;
            player.sprites[key].attackBox = {
                position: { x: player.position.x, y: player.position.y },
                offset: { x: xo, y: baseOff.y },
                width: w, height: h
            };
        }
        // preload
        const im = new Image();
        im.src = imgSrc;
        player.sprites[key].image = im;
    }
}

// === Background Data Setup ===
async function setBackground(bgName) {
    const list = await getBackgrounds();
    const b = list.find(x => x.Name === bgName);
    if (!b) throw new Error("no bg: " + bgName);
    return {
        imageSrc: b.BackgroundImage,
        groundLevel: 720 / b.GroundLevel,
        borderBackground: b.BorderBackground
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

async function determineDamage(player) {
    const avg = await getAvgAttackSurface();
    if (!avg) {
        player.damage = 0;
        return;
    }
    const surface = player.attackBox.width * Math.abs(player.attackBox.height);
    player.damage = 5 / (surface / avg);
}
