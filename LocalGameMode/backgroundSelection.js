// ==========================
// Imports
// ==========================
import {player1, player2} from "./fighterSelection.js";
import {
    setFighters,
    setBackgrounds,
    videoSource,
    videoElement
} from "../utils.js";

// ==========================
// Video Setup
// ==========================
videoSource.src = '/defaultBorderBackground/video';
videoElement.load();

// ==========================
// DOM Reference
// ==========================
const bgs = document.getElementById("backgrounds");

// ==========================
// Animation Loop
// ==========================
function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
}

// ==========================
// Random Background Picker
// ==========================
function pickRandomBackground() {
    const bgImages = document.querySelectorAll("#backgrounds img");
    if (bgImages.length === 0) return;

    // Clear highlight effect
    bgImages.forEach(img => {
        img.classList.remove('temp-brightness');
        void img.offsetWidth; // force reflow to reset animation
    });

    // Pick random background
    const randomIndex = Math.floor(Math.random() * bgImages.length);
    const chosenImage = bgImages[randomIndex];
    chosenImage.classList.add('temp-brightness');

    // Show the selected image in a separate container
    document.getElementById("pickedBackground").innerHTML =
        `<img src="${chosenImage.src}" id="pickedBackgroundImage" alt="${chosenImage.alt}">`;

    sessionStorage.setItem("background", chosenImage.alt);
}

// ==========================
// Start Background Roulette
// ==========================
function startRandomPick(duration = 5000, intervalTime = 150) {
    const intervalId = setInterval(pickRandomBackground, intervalTime);

    setTimeout(() => {
        clearInterval(intervalId);
    }, duration);

    setTimeout(() => {
        window.location.href = "/fightL";
    }, duration + 500);
}

// ==========================
// Initialization
// ==========================
async function init() {
    await setFighters(player1, player2);
    await setBackgrounds(bgs);
    animate();
    startRandomPick();
}

init();
