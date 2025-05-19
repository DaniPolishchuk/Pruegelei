// ==========================
// Imports & DOM references
// ==========================
import {
    getFighters,
    setSong,
    player1canvas,
    player2canvas,
    readyButton1,
    readyButton2,
    startButton,
    videoSource,
    videoElement,
    audio
} from "../utils.js";
import {MiniFighter} from "../classes.js";

// ==========================
// Player preview setup
// ==========================
const player1 = new MiniFighter(player1canvas, null);
const player2 = new MiniFighter(player2canvas, null);
player2.flipped = true;

// ==========================
// Background video setup
// ==========================
videoSource.src = '/defaultBorderBackground/video';
videoElement.load();

// ==========================
// Background audio setup
// ==========================
setSong(audio, window.sessionStorage.getItem('song'));

// ==========================
// Fighter selection list
// ==========================
const allFighters = [];

async function fillDivWithFighters() {
    getFighters().then(fighters => {
        for (const fighter of fighters) {
            const newButton = document.createElement("button");
            newButton.className = "fighter";

            const newCanvas = document.createElement("canvas");
            newCanvas.className = "miniCanvas";
            newButton.appendChild(newCanvas);

            const parent = document.getElementById("availableFighters");
            parent.appendChild(newButton);

            newCanvas.width = newButton.offsetWidth;
            newCanvas.height = newButton.offsetHeight;

            allFighters.push(new MiniFighter(
                newCanvas,
                fighter.Idle,
                fighter.SelectionMenuScale,
                fighter.IdleFrames,
                {
                    x: fighter.SelectionMenuOffsetX,
                    y: fighter.SelectionMenuOffsetY
                }
            ));

            newButton.addEventListener("click", () => selectFighter(fighter));
        }
    });
}

function selectFighter(fighter) {
    if (!readyButton1.pressed) {
        setFighterData(player1, fighter);
        readyButton1.style.visibility = "visible";
    } else if (!readyButton2.pressed) {
        setFighterData(player2, fighter);
        readyButton2.style.visibility = "visible";
    }
}

function setFighterData(player, fighter) {
    player.setImage(fighter.Idle);
    player.scale = fighter.SelectedScale;
    player.framesMax = fighter.IdleFrames;
    player.offset = {
        x: fighter.SelectedOffsetX,
        y: fighter.SelectedOffsetY
    };
    player.framesCurrent = 0;
    player.name = fighter.Name;
}

// ==========================
// Animation loop
// ==========================
function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
    allFighters.forEach(f => f.update());
}

// ==========================
// Ready and start button logic
// ==========================
function getReady(button) {
    if (!button.pressed) {
        button.style.backgroundColor = "orange";
        button.style.color = "black";
        button.pressed = true;
    } else {
        button.style.backgroundColor = "black";
        button.style.color = "orange";
        button.pressed = false;
    }

    if (readyButton1.pressed && readyButton2.pressed) {
        startButton.style.visibility = "visible";
    } else {
        startButton.style.visibility = "hidden";
    }
}

window.addEventListener('pageshow', () => {
    [readyButton1, readyButton2].forEach(btn => {
      btn.pressed = false;
      btn.style.backgroundColor = 'black';
      btn.style.color           = 'orange';
    });
  
    if (startButton) startButton.style.visibility = 'hidden';
});

function startBgPicking() {
    sessionStorage.setItem("player1", player1.name);
    sessionStorage.setItem("player2", player2.name);
    window.location.href = "/backgroundL";
}

// ==========================
// Button event listeners
// ==========================
if (readyButton1 && readyButton2 && startButton) {
    readyButton1.addEventListener("click", () => getReady(readyButton1));
    readyButton2.addEventListener("click", () => getReady(readyButton2));
    startButton.addEventListener("click", startBgPicking);
}

// ==========================
// Initialization
// ==========================
fillDivWithFighters();
animate();