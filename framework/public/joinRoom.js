const clientId = localStorage.getItem('clientId') || (() => {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    localStorage.setItem('clientId', id);
    return id;
})();

const client = new Client(`ws://${window.location.hostname}:2567`);
const roomsListEl = document.getElementById('roomsList');
const newRoomInput = document.getElementById('newRoomInput');
const createBtn = document.getElementById('createRoomBtn');

// Render list of available rooms
function renderRooms(rooms) {
    roomsListEl.innerHTML = rooms.length
        ? rooms.map(r => `
      <li style="cursor:pointer;">
        ${r.metadata.name} (${r.clients.length}/2)
      </li>
    `).join('')
        : '<li>No rooms available</li>';

    // Attach click handlers
    Array.from(roomsListEl.children).forEach((li, idx) => {
        if (rooms[idx].clients.length < 2) {
            li.onclick = () => joinExistingRoom(rooms[idx].roomId);
        }
    });
}

// Periodically fetch room list
setInterval(async () => {
    const rooms = await client.getAvailableRooms('fighter_room');
    renderRooms(rooms);
}, 1000);

// Create a new room
createBtn.onclick = async () => {
    const name = newRoomInput.value.trim();
    if (!name) return alert('Enter a room name');
    const room = await client.create('fighter_room', { clientId, roomName: name });
    sessionStorage.setItem('roomId', room.id);
    window.location.href = '/fighterSelection';
};

// Join an existing room by its roomId
async function joinExistingRoom(roomId) {
    const room = await client.joinById(roomId, { clientId });
    sessionStorage.setItem('roomId', room.id);
    window.location.href = '/fighterSelection';
}
