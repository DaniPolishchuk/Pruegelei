// 🧠 KI-Modelle initialisieren

let fighters = [];
let models = [];
let firstWinnerModel = null;



setInterval(() => {
    saveModel(models[1]);
    console.log("Modelle wurden gespeichert!");
}, 10 * 60 * 1000); // Alle 10 Minuten (10 * 60 Sekunden * 1000 Millisekunden)

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


// 🎮 Hauptspiel-Loop
async function gameLoop() {
    const state = getGameState();
    let actions = [];
    for (let i = 0; i < fighters.length; i++){
        actions.push(chooseAction(state, models[i]));
        executeAction(fighters[i], actions[i]);
    }

    const newState = getGameState();
    let reward = 0;
    let winner = null;

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
                    firstWinnerModel = models[i];
                }
            }

            // 🥊 Trefferlogik für Fighter2 → Fighter1
            if (rectangularCollision(fighter2, fighter1) && fighter2.isAttacking) {
                fighter1.health -= 10;
                //await trainModel(state, actions[i + 1], 2, newState, models[i + 1]);
                if (fighter1.health === 50) {
                    firstWinnerModel = models[i + 1];
                    await winnerModel(state, actions[i + 1], newState, models[i + 1]);
                }
            }

            if (firstWinnerModel) {
                resetGame()
            } else if (parseInt(document.getElementById("timer").textContent.trim()) === 0) {
                await trainModel(state, actions[i], -1, newState, models[i]);
                await trainModel(state, actions[i + 1], -1, newState, models[i + 1]);
                resetGame();
            }
        }
    }
    requestAnimationFrame(gameLoop);
}

async function winnerModel(state, action, newState, model) {
    await trainModel(state, action, 10, newState, model); // Training asynchron starten, ohne auf das Ergebnis zu warten

    // Starte die Mutation parallel für alle Modelle
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
function chooseAction(state, model) {
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

// 🏋️‍♂️ Training: Q-Learning
async function trainModel(state, action, reward, nextState, model) {
    console.log("Training...");
    const target = reward + 0.95 * Math.max(...model.predict(tf.tensor2d([nextState])).dataSync());
    const targets = model.predict(tf.tensor2d([state])).dataSync();
    targets[action] = target;

    await model.fit(tf.tensor2d([state]), tf.tensor2d([targets]), { epochs: 10 });
    console.log(model.getWeights());
}

// 🔄 Spielzustand abrufen (Platzhalterfunktion)
function getGameState() {
    return [player1.position.x, player1.position.y, player2.position.x, player2.position.y, parseInt(document.getElementById("timer").textContent.trim())]; // Beispielwerte
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
            player.attack();
            break;
    }
}


function resetGame() {
    for(let i = 0; i < fighters.length; i++){
        if(isEven(i)){
            fighters[i].position = { x: 0, y: 0 };
            fighters[i].health = 100;
        }else {
            fighters[i].position = { x: 400, y: 100 };
            fighters[i].health = 100;
        }
    }
    location.reload(true);
}

async function saveModel(model) {
    await model.save('localstorage://fighter-ai-model');
    console.log("Modell gespeichert!");
}

async function initializePlayers(fightCount){
    for(let i = 0; i <= fightCount; i++){
        fighters.push(new Fighter({
            position: {
                x: 400,
                y: 100,
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
                x: 0,
                y: 0,
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

function isEven(number) {
    return number % 2 === 0;  // Gibt true zurück, wenn die Zahl gerade ist
}

function isOdd(number) {
    return number % 2 !== 0;  // Gibt true zurück, wenn die Zahl ungerade ist
}

// 🏁 Spiel starten
initializePlayers(10).then(() => { initializeModels().then(() => {
    gameLoop();
})});