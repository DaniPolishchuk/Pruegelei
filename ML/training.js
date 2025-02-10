// 🧠 KI-Modelle initialisieren

let fighters = [];
let models = [];
let firstWinnerModel = null;

setInterval(async () => {
    await models[1].save('localstorage://fighter-ai-model');
    console.log("Modelle wurden gespeichert!");
}, 10 * 60 * 1000); // Alle 10 Minuten (10 * 60 Sekunden * 1000 Millisekunden)




// 🎮 Hauptspiel-Loop
async function gameLoop() {

    const actionPromises = fighters
        .filter((_, i) => i % 2 === 0) // NUR jeden zweiten Fighter nehmen (0, 2, 4, ...)
        .map((_, i) => chooseAction(getGameState(fighters[i], fighters[i + 1]), models[i]));

    const actions = await Promise.all(actionPromises);

    await Promise.all(fighters.map((fighter, i) => executeAction(fighter, actions[i])));

    for (let i = 0; i < fighters.length; i += 2) {
        if (i + 1 < fighters.length) { // Sicherstellen, dass ein Paar existiert
            let fighter1 = fighters[i];
            let fighter2 = fighters[i + 1];
            fighter1.update();
            fighter2.update();
            fighter1.velocity.x = 0;
            fighter2.velocity.x = 0;
            if (rectangularCollision(fighter1, fighter2) && fighter1.isAttacking) {
                fighter2.health -= 10;
                //await trainModel(state, actions[i], 2, newState, models[i]);
                if (fighter2.health === 50) {
                    await winnerModel(models[i]);
                }
            }

            // 🥊 Trefferlogik für Fighter2 → Fighter1
            if (rectangularCollision(fighter2, fighter1) && fighter2.isAttacking) {
                fighter1.health -= 10;
                //await trainModel(state, actions[i + 1], 2, newState, models[i + 1]);
                if (fighter1.health === 50) {
                    await winnerModel(models[i + 1]);
                }
            }

        }
    }
    resetGame();
    requestAnimationFrame(gameLoop);
}

async function winnerModel(model) {
    models = await Promise.all(models.map(async () => mutateModel(model)));
}

// 🏗️ Modell erstellen
function createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [5], units: 10, activation: "relu" })); // Erste versteckte Schicht
    model.add(tf.layers.dense({ units: 10, activation: "relu" })); // Zweite versteckte Schicht
    model.add(tf.layers.dense({ units: 5, activation: "softmax" })); // Ausgabe-Schicht
    model.compile({ optimizer: "adam", loss: "meanSquaredError" });
    return model;
}


// 🧬 Mutation: Modell leicht anpassen
function mutateModel(model, mutationRate = 0.5) {
    return tf.tidy(() => {
        const mutatedModel = createModel();
        const weights = model.getWeights().map(weight => {
            const shape = weight.shape;
            const values = weight.dataSync().map(val =>
                Math.random() < mutationRate ? val + tf.randomNormal([1], 0, 0.1).dataSync()[0] : val
            );
            return tf.tensor(values, shape);
        });
        mutatedModel.setWeights(weights);
        return mutatedModel;
    });
}

// 🎯 KI wählt eine Aktion
async function chooseAction(state, model) {
    return tf.tidy(() => {
        const input = tf.tensor2d([state]);
        const prediction = model.predict(input);
        const action = prediction.argMax(1).dataSync()[0]
        console.log("Aktion gewählt:", action);
        input.dispose();
        prediction.dispose();
        return action;
    });
}

// 🔄 Spielzustand abrufen
function getGameState(fighter1, fighter2) {
    return [
        fighter1.position.x / canvas.width,
        fighter1.position.y / canvas.height,
        fighter2.position.x / canvas.width,
        fighter2.position.y / canvas.height,
        parseInt(document.getElementById("timer").textContent.trim())
    ];
}

function executeAction(player, action) {
    switch (action) {
        case 0: // moveLeft
            if (player.position.x > 0) {
                player.velocity.x = -5;
            } else {
                player.velocity.x = 0;
            }
            break;
        case 1: // moveRight
            if (player.position.x + player.width < canvas.width) {
                player.velocity.x = 5;
            } else {
                player.velocity.x = 0; // Stoppe Bewegung am rechten Rand
            }
            break;
        case 2: // jump
            if (player.position.y + player.height >= canvas.height) {
                player.velocity.y = -20;
            }
            break;
        case 3: // attack
            debugger;
            player.attack();
            break;
    }
}



async function initializePlayers(fightCount){
    for(let i = 0; i <= fightCount; i++){
        fighters.push(new Fighter({
            position: {
                x: canvas.width * 0.05, // 5% der Canvas-Breite
                y: canvas.height * 0.15,
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
        }));
        fighters.push(new Fighter({
            position: {
                x: canvas.width * 0.50, // 50% der Canvas-Breite
                y: canvas.height * 0.15,
            },
            velocity: {
                x: 0,
                y: 0,
            },
            color: "red",
            offset: {
                x: 50,
                y: 0,
            }
        }));
    }
    return fighters;
}
async function initializeModels() {
    for(let i = 0; i <= fighters.length; i++){
        models.push(createModel());
    }
}

async function loadModel() {
    try {
        const model = await tf.loadLayersModel('localstorage://fighter-ai-model');
        console.log("Gespeichertes Modell geladen!");
        return model;
    } catch (error) {
        console.log("Kein gespeichertes Modell gefunden, neues Modell wird erstellt.");
        return createModel(); // Falls kein Modell existiert, erstelle ein neues
    }
}

function isEven(number) {
    return number % 2 === 0;  // Gibt true zurück, wenn die Zahl gerade ist
}

function resetGame() {
    for(let i = 0; i < fighters.length; i++){
        if(isEven(i)){
            fighters[i].position = { x: canvas.width * 0.05, // 5% der Canvas-Breite
                y: canvas.height * 0.15 };
            fighters[i].health = 100;
        }else {
            fighters[i].position = { x: canvas.width * 0.50, // 50% der Canvas-Breite
                y: canvas.height * 0.15 };
            fighters[i].health = 100;
        }
    }
    location.reload(true);
}

// 🏁 Spiel starten
initializePlayers(10).then(() => { initializeModels().then(() => {
    gameLoop();
})});