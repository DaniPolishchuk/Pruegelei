// joinRoom.js
// (move this out of your HTML into src/joinRoom.js)

(() => {
    // Persistent clientId
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('clientId', clientId);
    }

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://${window.location.host}`);
    socket.binaryType = "blob";

    // Ask for rooms on connect
    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'getRooms' }));
    });

    socket.addEventListener('message', event => {
        const handle = data => {
            if (data.type === 'roomsList') {
                updateRoomsList(data.rooms);
            }
            if (data.type === 'roomCreated' || data.type === 'roomJoined') {
                sessionStorage.setItem('room', data.room);
                sessionStorage.setItem('myPlayerId', data.playerId);
                setTimeout(() => {
                    window.location.href = "/fighterSelection";
                }, 500);
            }
            if (data.type === 'error') {
                alert(data.message);
            }
        };

        if (event.data instanceof Blob) {
            event.data.text().then(text => {
                try { handle(JSON.parse(text)); }
                catch (e) { console.error(e); }
            });
        } else {
            try { handle(JSON.parse(event.data)); }
            catch (e) { console.error(e); }
        }
    });

    function updateRoomsList(rooms) {
        const ul = document.getElementById('roomsList');
        ul.innerHTML = '';
        if (rooms.length === 0) {
            ul.innerHTML = '<li>No rooms available</li>';
        } else {
            rooms.forEach(r => {
                const li = document.createElement('li');
                li.textContent = `${r.name} (${r.count}/2)`;
                li.style.cursor = 'pointer';
                if (r.count < 2) {
                    li.addEventListener('click', () => {
                        sessionStorage.setItem('room', r.name);
                        socket.send(JSON.stringify({
                            type: 'joinRoom',
                            room: r.name,
                            clientId
                        }));
                    });
                }
                ul.appendChild(li);
            });
        }
    }

    document.getElementById('createRoomBtn').onclick = () => {
        const name = document.getElementById('newRoomInput').value.trim();
        if (!name) return alert('Enter a room name');
        socket.send(JSON.stringify({ type: 'createRoom', room: name, clientId }));
    };

    document.getElementById('joinRoomBtn').onclick = () => {
        const name = document.getElementById('roomInput').value.trim();
        if (!name) return alert('Enter a room name');
        socket.send(JSON.stringify({ type: 'joinRoom', room: name, clientId }));
    };

    document.getElementById('localModeBtn').onclick = () => {
        sessionStorage.setItem('room', 'local');
        sessionStorage.setItem('myPlayerId', 1);
        socket.send(JSON.stringify({ type: 'joinRoom', room: 'local', clientId }));
    };
})();
