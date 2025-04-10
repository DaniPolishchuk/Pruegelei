import {player1, player2} from "../FighterSelection/index.js";
//import { getBackgrounds, getFighters } from "../Fight/js/utils.js";

const bgs = document.getElementById("backgrounds");

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

async function setFighters() {
    const fighterName1 = sessionStorage.getItem("player1");
    const fighterName2 = sessionStorage.getItem("player2");

    getFighters().then(fighters => {
        const fighter1 = fighters.find(f => f.Name === fighterName1);
        player1.setImage(fighter1.Idle);
        player1.scale = fighter1.BackgroundSelectionScale;
        player1.framesMax = fighter1.IdleFrames;
        player1.offset = {
            x: fighter1.BackgroundSelectionOffsetX,
            y: fighter1.BackgroundSelectionOffsetY
        };
        player1.framesHold = 8;
        const fighter2 = fighters.find(f => f.Name === fighterName2);
        player2.setImage(fighter2.Idle);
        player2.scale = fighter2.BackgroundSelectionScale;
        player2.framesMax = fighter2.IdleFrames;
        player2.offset = {
            x: fighter2.BackgroundSelectionOffsetX,
            y: fighter2.BackgroundSelectionOffsetY
        };
        player2.framesHold = 8;
    });
}

function animate() {
    window.requestAnimationFrame(animate);
    player1.update();
    player2.update();
}

async function getBackgrounds() {
    try {
        const response = await fetch("http://127.0.0.1:5001/backgrounds");
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error fetching backgrounds:", error);
        return [];
    }
}

// Populate the #backgrounds container with your background images
async function setBackgrounds() {
    getBackgrounds().then(backgrounds => {
        for (const background of backgrounds) {
            let newImage = document.createElement("img");
            newImage.src = background.BackgroundImage;
            newImage.className = "backgroundImage";
            newImage.alt = background.Name;

            bgs.appendChild(newImage);
        }
    });
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
        window.location.href = "/fight"
    }, duration + 500);
}

// Initialize the process once the backgrounds are loaded
async function init() {
    await setFighters();
    await setBackgrounds();
    animate();
    startRandomPick();
}

init();