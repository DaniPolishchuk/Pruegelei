(async () => {
    // 1) clientId
    let clientId = localStorage.getItem('clientId');
    if (!clientId) {
        clientId = Date.now() + '_' + Math.random().toString(36).substr(2);
        localStorage.setItem('clientId', clientId);
    }

    // 2) room
    const room = sessionStorage.getItem('room');
    if (!room) return alert('No room—join or create first');

    // 3) WS
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${proto}://${location.host}`);
    socket.binaryType = 'blob';

    let myPlayerId = null;

    socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'joinRoom', room, clientId }));
    });

    socket.addEventListener('message', async ev => {
        let txt = ev.data instanceof Blob
            ? await ev.data.text()
            : (typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data));
        let msg;
        try { msg = JSON.parse(txt); } catch { return; }

        if (msg.type === 'roomJoined') {
            myPlayerId = msg.playerId;
            initSelection();
        }
    });

    // 4) selection + ready + start
    async function getFighters() {
        const res = await fetch('/fighters');
        if (!res.ok) throw new Error(res.status);
        return await res.json();
    }

    class MiniFighter {
        constructor(canvas, src, scale, frames, offset) {
            this.ctx = canvas.getContext('2d');
            this.img = new Image();
            this.loaded = false;
            this.img.onload = () => this.loaded = true;
            this.scale = scale || 1;
            this.framesMax = frames || 1;
            this.current = 0; this.elapsed = 0; this.hold = 4;
            this.offset = offset || { x: 0, y: 0 };
            this.flipped = false;
            if (src) this.img.src = src;
        }
        draw() {
            if (!this.loaded) return;
            const fw = this.img.width / this.framesMax;
            const dw = fw * this.scale, dh = this.img.height * this.scale;
            const dx = -this.offset.x, dy = -this.offset.y;
            if (this.flipped) {
                this.ctx.save();
                this.ctx.scale(-1, 1);
                this.ctx.drawImage(this.img, this.current * fw, 0, fw, this.img.height,
                    -(dx + dw), dy, dw, dh);
                this.ctx.restore();
            } else {
                this.ctx.drawImage(this.img, this.current * fw, 0, fw, this.img.height,
                    dx, dy, dw, dh);
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

    // DOM
    const c1 = document.getElementById('player1canvas');
    c1.width = c1.offsetWidth; c1.height = c1.offsetHeight;
    const p1 = new MiniFighter(c1);
    const c2 = document.getElementById('player2canvas');
    c2.width = c2.offsetWidth; c2.height = c2.offsetHeight;
    const p2 = new MiniFighter(c2); p2.flipped = true;

    const grid = document.getElementById('availableFighters');
    const ready1 = document.getElementById('readyButton1');
    const ready2 = document.getElementById('readyButton2');
    const startBtn = document.getElementById('startButton');

    let selLocal = false, selRemote = false;
    let readyLocal = false, readyRemote = false;

    function animate() {
        requestAnimationFrame(animate);
        p1.update(); p2.update();
        document.querySelectorAll('.miniCanvas').forEach(cv => {
            const mf = cv._mf; if (mf) mf.update();
        });
    }

    function refreshStart() {
        startBtn.style.visibility = (selLocal && selRemote && readyLocal && readyRemote)
            ? 'visible' : 'hidden';
    }

    async function initSelection() {
        // hide both ready + start
        ready1.style.visibility = 'hidden';
        ready2.style.visibility = 'hidden';
        startBtn.style.visibility = 'hidden';
        ready1.disabled = myPlayerId !== 1;
        ready2.disabled = myPlayerId !== 2;

        const fighters = await getFighters();
        fighters.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'fighter';
            const cvs = document.createElement('canvas');
            cvs.className = 'miniCanvas';
            btn.appendChild(cvs); grid.appendChild(btn);
            cvs.width = btn.offsetWidth; cvs.height = btn.offsetHeight;
            const mf = new MiniFighter(cvs, f.Idle, f.SelectionMenuScale, f.IdleFrames, {
                x: f.SelectionMenuOffsetX, y: f.SelectionMenuOffsetY
            });
            cvs._mf = mf;

            btn.onclick = () => {
                if (!selLocal) {
                    const tgt = myPlayerId === 1 ? p1 : p2;
                    tgt.img.src = f.Idle; tgt.scale = f.SelectedScale;
                    tgt.framesMax = f.IdleFrames; tgt.offset = {
                        x: f.SelectedOffsetX, y: f.SelectedOffsetY
                    };
                    sessionStorage.setItem(`player${myPlayerId}`, f.Name);
                    selLocal = true;
                    if (myPlayerId === 1) ready1.style.visibility = 'visible';
                    else ready2.style.visibility = 'visible';
                    socket.send(JSON.stringify({
                        type: 'fighterSelected', fighter: f.Name, playerId: myPlayerId
                    }));
                }
                refreshStart();
            };
        });

        socket.addEventListener('message', async ev => {
            let txt = ev.data instanceof Blob ? await ev.data.text() :
                typeof ev.data === 'string' ? ev.data :
                    new TextDecoder().decode(ev.data);
            let msg; try { msg = JSON.parse(txt); } catch { return; }

            if (msg.type === 'fighterSelected' && msg.playerId !== myPlayerId) {
                const fighters = await getFighters();
                const f = fighters.find(x => x.Name === msg.fighter);
                const tgt = msg.playerId === 1 ? p1 : p2;
                tgt.img.src = f.Idle; tgt.scale = f.SelectedScale;
                tgt.framesMax = f.IdleFrames; tgt.offset = {
                    x: f.SelectedOffsetX, y: f.SelectedOffsetY
                };
                selRemote = true;
                // now show remote's ready
                if (msg.playerId === 1) ready1.style.visibility = 'visible';
                else ready2.style.visibility = 'visible';
                refreshStart();
            }

            if (msg.type === 'ready') {
                if (msg.playerId !== myPlayerId) {
                    readyRemote = msg.ready;
                    const btn = msg.playerId === 1 ? ready1 : ready2;
                    btn.style.visibility = 'visible';
                    btn.style.backgroundColor = msg.ready ? 'orange' : 'black';
                    btn.style.color = msg.ready ? 'black' : 'orange';
                    readyRemote = msg.ready;
                    refreshStart();
                }
            }

            if (msg.type === 'gameStart') {
                // server also includes: msg.background
                sessionStorage.setItem('background', msg.background);
                window.location.href = '/background';
            }
        });

        ready1.onclick = () => {
            if (myPlayerId !== 1 || !selLocal) return;
            readyLocal = !readyLocal;
            ready1.style.backgroundColor = readyLocal ? 'orange' : 'black';
            ready1.style.color = readyLocal ? 'black' : 'orange';
            socket.send(JSON.stringify({
                type: 'ready', playerId: 1, ready: readyLocal
            }));
            refreshStart();
        };

        ready2.onclick = () => {
            if (myPlayerId !== 2 || !selLocal) return;
            readyLocal = !readyLocal;
            ready2.style.backgroundColor = readyLocal ? 'orange' : 'black';
            ready2.style.color = readyLocal ? 'black' : 'orange';
            socket.send(JSON.stringify({
                type: 'ready', playerId: 2, ready: readyLocal
            }));
            refreshStart();
        };

        // When *you* click Start (only visible after both ready),
        // you send gameStart → server picks and relays with background.
        startBtn.onclick = () => {
            socket.send(JSON.stringify({ type: 'gameStart' }));
        };

        animate();
    }
})();
