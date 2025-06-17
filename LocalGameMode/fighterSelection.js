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
  audio,
} from "../utils.js";
import { MiniFighter } from "../classes.js";

// ==========================
// Player preview setup
// ==========================
const player1 = new MiniFighter(player1canvas, null);
const player2 = new MiniFighter(player2canvas, null);
player2.flipped = true;

const fighter2 = document.getElementById("fighter2");

const aiButton = document.createElement("button");
aiButton.textContent = "KI";
aiButton.classList.add("aiButton");
aiButton.id = "aiToggleButton";

aiButton.style.position = "absolute";
aiButton.style.top = "5vh";
aiButton.style.right = "20vh";

// SessionStorage lesen & setzen
const savedAI = sessionStorage.getItem("aiEnabled") === "true";
if (savedAI) {
  aiButton.classList.add("active");
}

aiButton.addEventListener("click", () => {
  aiButton.classList.toggle("active");
  const isActive = aiButton.classList.contains("active");
  sessionStorage.setItem("ai", isActive.toString());
  console.log("KI ist jetzt:", isActive ? "AN" : "AUS");
});

fighter2.appendChild(aiButton);

// ==========================
// Background video setup
// ==========================
videoSource.src = "/Assets/Backgrounds/Default/video.bin";
videoElement.load();

// ==========================
// Background audio setup
// ==========================
setSong(audio, window.sessionStorage.getItem("song"));

// ==========================
// Fighter selection list
// ==========================
const allFighters = [];

async function fillDivWithFighters() {
  getFighters().then((fighters) => {
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

      allFighters.push(
        new MiniFighter(
          newCanvas,
          `/Assets/Fighters/${fighter.name}/idle.png`,
          fighter.selectionMenuScale,
          fighter.idleFrames,
          {
            x: fighter.selectionMenuOffsetX,
            y: fighter.selectionMenuOffsetY,
          },
        ),
      );

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
  player.setImage(`/Assets/Fighters/${fighter.name}/idle.png`);
  player.scale = fighter.selectedScale;
  player.framesMax = fighter.idleFrames;
  player.offset = {
    x: fighter.selectedOffsetX,
    y: fighter.selectedOffsetY,
  };
  player.framesCurrent = 0;
  player.name = fighter.name;
}

// ==========================
// Animation loop
// ==========================
function animate() {
  player1.update();
  player2.update();
  allFighters.forEach((f) => f.update());
  requestAnimationFrame(animate);
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

window.addEventListener("pageshow", () => {
  [readyButton1, readyButton2].forEach((btn) => {
    btn.pressed = false;
    btn.style.backgroundColor = "black";
    btn.style.color = "orange";
  });

  if (startButton) startButton.style.visibility = "hidden";
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
