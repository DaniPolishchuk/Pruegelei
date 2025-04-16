(() => {
    // 1) Persistent clientId
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = Date.now() + '_' + Math.random().toString(36).substr(2);
        localStorage.setItem('clientId', clientId);
    }

    // 2) WS to same host:port
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}`);
    socket.binaryType = 'blob';

    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'getRooms' }));
    });

    socket.addEventListener('message', ev => {
        const d = JSON.parse(ev.data);
        switch (d.type) {
            case 'roomsList':
                renderRooms(d.rooms);
                break;

            case 'roomCreated':
                // Immediately go pick fighters
                sessionStorage.setItem('room', d.room);
                sessionStorage.setItem('myPlayerId', 1);
                window.location.href = '/fighterSelection';
                break;

            case 'roomJoined':
                // Joiner lands here
                sessionStorage.setItem('room', d.room);
                sessionStorage.setItem('myPlayerId', d.playerId);
                window.location.href = '/fighterSelection';
                break;

            case 'error':
                alert(d.message);
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

    document.getElementById('createRoomBtn').onclick = () => {
        const n = document.getElementById('newRoomInput').value.trim();
        if (!n) return alert('Enter a room name.');
        socket.send(JSON.stringify({ type: 'createRoom', room: n, clientId }));
    };
    document.getElementById('joinRoomBtn').onclick = () => {
        const n = document.getElementById('roomInput').value.trim();
        if (!n) return alert('Enter a room name.');
        socket.send(JSON.stringify({ type: 'joinRoom', room: n, clientId }));
    };
    document.getElementById('localModeBtn').onclick = () => {
        sessionStorage.setItem('room', 'local');
        sessionStorage.setItem('myPlayerId', 1);
        socket.send(JSON.stringify({ type: 'joinRoom', room: 'local', clientId }));
    };
})();
