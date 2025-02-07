function rectangularCollusion(rectangel1, rectangel2) {
    return (
        rectangel1.attackBox.position.x + rectangel1.attackBox.width >= rectangel2.position.x &&
        rectangel1.attackBox.position.x <= rectangel2.position.x + rectangel2.width &&
        rectangel1.attackBox.position.y + rectangel1.attackBox.height >= rectangel2.position.y &&
        rectangel1.attackBox.position.y <= rectangel2.position.y + rectangel2.height
    )
}

function determineWinner(player1, player2, timerId) {
    clearTimeout(timerId);
    document.querySelector("#gameResult").style.display = "flex";
    if (player1.health > player2.health) {
        document.querySelector("#gameResult").innerHTML = "Player 1 won";
    } else if (player1.health < player2.health) {
        document.querySelector("#gameResult").innerHTML = "Player 2 won";
    } else {
        document.querySelector("#gameResult").innerHTML = "Tie";
    }
}

let timerID;
function decreaseTimer(){
    let timerValue = parseInt(document.getElementById("timer").textContent.trim());
    if (timerValue > 0) {
        timerID = setTimeout(decreaseTimer, 1000);
        timerValue--;
        document.getElementById("timer").textContent = String(timerValue);
    } else if (timerValue === 0) {
        determineWinner(player1, player2);
    }
}