import {player1, player2} from "../FighterSelection/fighterSelection.js";
import {setFighters, setBackgrounds} from "../../Fight/js/utils.js";

const bgs = document.getElementById("backgrounds");

function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
}

function pickRandomBackground() {
    // Select all the images in the #backgrounds container
    const bgImages = document.querySelectorAll("#backgrounds img");
    if (bgImages.length === 0) return;

    // Remove the temporary grayscale class from all images
    bgImages.forEach(img => {
        img.classList.remove('temp-brightness');
        // Force reflow so the animation can be restarted if the same image is chosen again.
        void img.offsetWidth;
    });

    // Choose a random index
    const randomIndex = Math.floor(Math.random() * bgImages.length);
    const chosenImage = bgImages[randomIndex];

    // Add the temporary grayscale class to trigger the animation
    chosenImage.classList.add('temp-brightness');

    // Update the pickedBackground div with the selected image (without effect)
    document.getElementById("pickedBackground").innerHTML =
        `<img src="${chosenImage.src}" id="pickedBackgroundImage" alt="${chosenImage.alt}">`;
    sessionStorage.setItem("background", chosenImage.alt)
}


// Function to start the random picking process and stop it after a duration
function startRandomPick(duration = 5000, intervalTime = 150) {
    // Every intervalTime milliseconds, pick a random background
    const intervalId = setInterval(pickRandomBackground, intervalTime);

    // After 'duration' milliseconds, stop the random picking
    setTimeout(() => {
        clearInterval(intervalId);
    }, duration);

    setTimeout(() => {
        window.location.href = "/fightLoc"
    }, duration + 500);
}

// Initialize the process once the backgrounds are loaded
async function init() {
    await setFighters(player1, player2);
    await setBackgrounds(bgs);
    animate();
    startRandomPick();
}

init();