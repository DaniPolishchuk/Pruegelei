(() => {
    // 1) Persistent clientId
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = Date.now() + '_' + Math.random().toString(36).substr(2);
        localStorage.setItem('clientId', clientId);
    }

    // 2) WebSocket → same host:port you used in the URL bar
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}`);
    socket.binaryType = 'blob';

    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'getRooms' }));
    });

    socket.addEventListener('message', ev => {
        const data = JSON.parse(ev.data);
        switch (data.type) {
            case 'roomsList':
                renderRooms(data.rooms);
                break;

            case 'roomCreated':
                // Host: stay in lobby, waiting for someone to join
                console.log('Created room:', data.room);
                sessionStorage.setItem('room', data.room);
                break;

            case 'roomJoined':
                // Both host & joiner end up here when 2nd player arrives
                console.log('Joined room as player', data.playerId);
                sessionStorage.setItem('room', data.room);
                sessionStorage.setItem('myPlayerId', data.playerId);
                setTimeout(() => {
                    window.location.href = '/fighterSelection';
                }, 200);
                break;

            case 'error':
                alert(data.message);
                break;
        }
    });

    function renderRooms(rooms) {
        const ul = document.getElementById('roomsList');
        ul.innerHTML = '';
        if (!rooms.length) {
            ul.innerHTML = '<li>No rooms available</li>';
            return;
        }
        rooms.forEach(r => {
            const li = document.createElement('li');
            li.textContent = `${r.name} (${r.count}/2)`;
            li.style.cursor = r.count < 2 ? 'pointer' : 'not-allowed';
            if (r.count < 2) {
                li.onclick = () => {
                    socket.send(JSON.stringify({
                        type: 'joinRoom',
                        room: r.name,
                        clientId
                    }));
                };
            }
            ul.appendChild(li);
        });
    }

    // UI bindings
    document.getElementById('createRoomBtn').onclick = () => {
        const name = document.getElementById('newRoomInput').value.trim();
        if (!name) return alert('Please enter a room name.');
        socket.send(JSON.stringify({ type: 'createRoom', room: name, clientId }));
    };
    document.getElementById('joinRoomBtn').onclick = () => {
        const name = document.getElementById('roomInput').value.trim();
        if (!name) return alert('Please enter a room name.');
        socket.send(JSON.stringify({ type: 'joinRoom', room: name, clientId }));
    };
    document.getElementById('localModeBtn').onclick = () => {
        sessionStorage.setItem('room', 'local');
        sessionStorage.setItem('myPlayerId', 1);
        socket.send(JSON.stringify({ type: 'joinRoom', room: 'local', clientId }));
    };
})();
