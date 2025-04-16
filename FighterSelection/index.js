// FighterSelection/index.js

(async () => {
    // 1) Persist a unique clientId
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = Date.now() + '_' + Math.random().toString(36).substr(2);
        localStorage.setItem('clientId', clientId);
    }

    // 2) Grab the room
    const room = sessionStorage.getItem('room');
    if (!room) {
        alert('No room found. Please create or join a room first.');
        return;
    }

    // 3) Open WS and rejoin
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}`);
    socket.binaryType = 'blob';

    let myPlayerId = null;

    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'joinRoom', room, clientId }));
    });

    socket.addEventListener('message', async ev => {
        // normalize to text
        let txt;
        if (ev.data instanceof Blob) txt = await ev.data.text();
        else if (typeof ev.data === 'string') txt = ev.data;
        else if (ev.data instanceof ArrayBuffer) txt = new TextDecoder().decode(ev.data);
        else return;

        let msg;
        try { msg = JSON.parse(txt); } catch { return; }

        if (msg.type === 'roomJoined') {
            myPlayerId = msg.playerId;
            sessionStorage.setItem('myPlayerId', myPlayerId);
            initFighterSelection();
        }
    });

    // --- Fighter‑selection code below ---

    async function getFighters() {
        try {
            const res = await fetch('/fighters');
            if (!res.ok) throw new Error(res.status);
            return await res.json();
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    class MiniFighter {
        constructor(canvas, src, scale, frames, offset) {
            this.ctx = canvas.getContext('2d');
            this.img = new Image();
            this.loaded = false;
            this.img.onload = () => (this.loaded = true);
            this.scale = scale || 1;
            this.framesMax = frames || 1;
            this.current = 0;
            this.elapsed = 0;
            this.hold = 4;
            this.offset = offset || { x: 0, y: 0 };
            this.flipped = false;
            if (src) this.img.src = src;
        }
        draw() {
            if (!this.loaded) return;
            const fw = this.img.width / this.framesMax;
            const dw = fw * this.scale;
            const dh = this.img.height * this.scale;
            const dx = -this.offset.x, dy = -this.offset.y;
            if (this.flipped) {
                this.ctx.save();
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(
                    this.img,
                    this.current * fw, 0, fw, this.img.height,
                    -(dx + dw), dy, dw, dh
                );
                this.ctx.restore();
            } else {
                this.ctx.drawImage(
                    this.img,
                    this.current * fw, 0, fw, this.img.height,
                    dx, dy, dw, dh
                );
            }
        }
        update() {
            this.draw();
            this.elapsed++;
            if (this.elapsed % this.hold === 0) {
                this.current = (this.current + 1) % this.framesMax;
            }
        }
    }

    // DOM refs
    const c1 = document.getElementById('player1canvas');
    c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
    const player1 = new MiniFighter(c1);

    const c2 = document.getElementById('player2canvas');
    c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
    const player2 = new MiniFighter(c2);
    player2.flipped = true;

    const grid = document.getElementById('availableFighters');
    const ready1 = document.getElementById('readyButton1');
    const ready2 = document.getElementById('readyButton2');
    const startBtn = document.getElementById('startButton');

    let localSelected = false;
    let remoteSelected = false;
    let localReady = false;
    let remoteReady = false;

    function animate() {
        requestAnimationFrame(animate);
        player1.update();
        player2.update();
        document.querySelectorAll('.miniCanvas').forEach(cv => {
            if (cv._mf) cv._mf.update();
        });
    }

    function updateStartVisibility() {
        if (localSelected && remoteSelected && localReady && remoteReady) {
            startBtn.style.visibility = 'visible';
        } else {
            startBtn.style.visibility = 'hidden';
        }
    }

    async function initFighterSelection() {
        // Hide both Ready & Start on load
        ready1.style.visibility = 'hidden';
        ready2.style.visibility = 'hidden';
        startBtn.style.visibility = 'hidden';
        // Only enable your own ready button after selection
        ready1.disabled = myPlayerId !== 1;
        ready2.disabled = myPlayerId !== 2;

        // Build fighter grid
        const fighters = await getFighters();
        fighters.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'fighter';
            const cvs = document.createElement('canvas');
            cvs.className = 'miniCanvas';
            btn.appendChild(cvs);
            grid.appendChild(btn);
            cvs.width = btn.offsetWidth;
            cvs.height = btn.offsetHeight;

            const mf = new MiniFighter(
                cvs,
                f.Idle,
                f.SelectionMenuScale,
                f.IdleFrames,
                { x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY }
            );
            cvs._mf = mf;

            btn.onclick = () => {
                if (!localSelected) {
                    const target = myPlayerId === 1 ? player1 : player2;
                    target.img.src = f.Idle;
                    target.scale = f.SelectedScale;
                    target.framesMax = f.IdleFrames;
                    target.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                    sessionStorage.setItem(`player${myPlayerId}`, f.Name);
                    localSelected = true;
                    // show your own ready
                    if (myPlayerId === 1) ready1.style.visibility = 'visible';
                    else ready2.style.visibility = 'visible';

                    socket.send(JSON.stringify({
                        type: 'fighterSelected',
                        fighter: f.Name,
                        playerId: myPlayerId
                    }));
                }
                updateStartVisibility();
            };
        });

        // Handle incoming messages after init
        socket.addEventListener('message', async ev => {
            let txt;
            if (ev.data instanceof Blob) txt = await ev.data.text();
            else if (typeof ev.data === 'string') txt = ev.data;
            else if (ev.data instanceof ArrayBuffer) txt = new TextDecoder().decode(ev.data);
            else return;

            let msg;
            try { msg = JSON.parse(txt); } catch { return; }

            if (msg.type === 'fighterSelected' && msg.playerId !== myPlayerId) {
                // remote picked
                const fighters = await getFighters();
                const f = fighters.find(x => x.Name === msg.fighter);
                const target = msg.playerId === 1 ? player1 : player2;
                target.img.src = f.Idle;
                target.scale = f.SelectedScale;
                target.framesMax = f.IdleFrames;
                target.offset = { x: f.SelectedOffsetX, y: f.SelectedOffsetY };
                remoteSelected = true;
                // show remote’s ready button now that they’ve picked
                if (msg.playerId === 1) ready1.style.visibility = 'visible';
                else ready2.style.visibility = 'visible';
                updateStartVisibility();
            }

            if (msg.type === 'ready') {
                if (msg.playerId !== myPlayerId) {
                    remoteReady = msg.ready;
                    const btn = msg.playerId === 1 ? ready1 : ready2;
                    btn.style.visibility = 'visible';
                    if (remoteReady) {
                        btn.style.backgroundColor = 'orange';
                        btn.style.color = 'black';
                    } else {
                        btn.style.backgroundColor = 'black';
                        btn.style.color = 'orange';
                    }
                    updateStartVisibility();
                }
            }

            if (msg.type === 'gameStart') {
                window.location.href = '/fight';
            }
        });

        // Your own Ready toggle
        ready1.onclick = () => {
            if (myPlayerId !== 1) return;
            localReady = !localReady;
            ready1.style.backgroundColor = localReady ? 'orange' : 'black';
            ready1.style.color = localReady ? 'black' : 'orange';
            socket.send(JSON.stringify({
                type: 'ready',
                playerId: 1,
                ready: localReady
            }));
            updateStartVisibility();
        };
        ready2.onclick = () => {
            if (myPlayerId !== 2) return;
            localReady = !localReady;
            ready2.style.backgroundColor = localReady ? 'orange' : 'black';
            ready2.style.color = localReady ? 'black' : 'orange';
            socket.send(JSON.stringify({
                type: 'ready',
                playerId: 2,
                ready: localReady
            }));
            updateStartVisibility();
        };

        // Start button
        startBtn.onclick = () => {
            socket.send(JSON.stringify({ type: 'gameStart' }));
        };

        animate();
    }
})();
