// ==========================
// Imports & Socket Setup
// ==========================
import {
    setSong,
    videoSource,
    videoElement,
    audio
} from "../utils.js";

const socket = io();

const clientId = localStorage.clientId || (() => {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    localStorage.clientId = id;
    return id;
})();

// ==========================
// DOM References
// ==========================
const roomsList = document.getElementById('roomsList');
const createBtn = document.getElementById('createRoomBtn');
const joinBtn = document.getElementById('joinRoomBtn');
const newRoomInput = document.getElementById('newRoomInput');
const joinRoomInput = document.getElementById('roomInput');

// ==========================
// Background Video
// ==========================
videoSource.src = '/defaultBorderBackground/video';
videoElement.load();

// ==========================
// Background Audio
// ==========================
setSong(audio);

// ==========================
// Room Rendering
// ==========================
function renderRooms(list) {
    roomsList.innerHTML = '';
    if (!list.length) {
        roomsList.innerHTML = '<li>No rooms available</li>';
        return;
    }
    list.forEach(r => {
        const li = document.createElement('li');
        li.textContent = `${r.name} (${r.count}/2 players)`;
        li.style.cursor = r.count < 2 ? 'pointer' : 'not-allowed';
        if (r.count < 2) {
            li.onclick = () => socket.emit('joinRoom', {roomName: r.name, clientId});
        }
        roomsList.appendChild(li);
    });
}

// ==========================
// Socket Events
// ==========================
socket.on('connect', () => socket.emit('getRooms'));
socket.on('roomsList', renderRooms);

socket.on('roomCreated', ({room, playerId}) => {
    sessionStorage.setItem('room', room);
    sessionStorage.setItem('playerId', playerId);
    window.location.href = '/fighterSelection';
});

socket.on('roomJoined', ({room, playerAssignments}) => {
    const our = playerAssignments.find(p => p.clientId === clientId);
    sessionStorage.setItem('room', room);
    sessionStorage.setItem('playerId', our.playerId);
    window.location.href = '/fighterSelection';
});

socket.on('error', msg => alert(msg));

// ==========================
// Button Event Handlers
// ==========================
createBtn.onclick = () => {
    const name = newRoomInput.value.trim();
    if (!name) return alert('Please enter a room name.');
    socket.emit('createRoom', {roomName: name, clientId});
};

joinBtn.onclick = () => {
    const name = joinRoomInput.value.trim();
    if (!name) return alert('Please enter a room name.');
    socket.emit('joinRoom', {roomName: name, clientId});
};

document.getElementById('localModeBtn').onclick = () => {
    sessionStorage.setItem('room', 'local');
    sessionStorage.setItem('playerId', 1);
    window.location.href = '/fighterSelectionL';
};
