const socket = io();
let selectedToken = null;
let currentRoom = null;
let myPlayerId = null;
let isHost = false;

function selectToken(el) {
    document.querySelectorAll('.token-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    selectedToken = el.dataset.token;
}

function showError(msg) {
    const el = document.getElementById('error-msg');
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3000);
}

function showJoinInput() {
    document.getElementById('join-section').classList.toggle('hidden');
}

function validate() {
    const name = document.getElementById('player-name').value.trim();
    if (!name) { showError('Masukkan nama pemain!'); return null; }
    if (!selectedToken) { showError('Pilih pion terlebih dahulu!'); return null; }
    return name;
}

function createRoom() {
    const name = validate();
    if (!name) return;
    socket.emit('create-room', { name, token: selectedToken }, (res) => {
        if (res.success) {
            currentRoom = res.code;
            myPlayerId = res.playerId;
            isHost = true;
            showLobby();
        } else {
            showError(res.error);
        }
    });
}

function joinRoom() {
    const name = validate();
    if (!name) return;
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    if (!code) { showError('Masukkan kode room!'); return; }
    socket.emit('join-room', { code, name, token: selectedToken }, (res) => {
        if (res.success) {
            currentRoom = res.code;
            myPlayerId = res.playerId;
            isHost = false;
            showLobby();
        } else {
            showError(res.error);
        }
    });
}

function showLobby() {
    document.getElementById('landing-screen').classList.remove('active');
    document.getElementById('lobby-screen').classList.add('active');
    document.getElementById('lobby-room-code').textContent = currentRoom;
    if (isHost) {
        document.getElementById('host-controls').classList.remove('hidden');
    }
}

function copyRoomCode() {
    navigator.clipboard.writeText(currentRoom);
    const el = document.querySelector('.copy-hint');
    el.textContent = '✅ Tersalin!';
    setTimeout(() => el.textContent = '📋 Klik untuk salin', 2000);
}

function addBot() {
    socket.emit('add-bot');
}

function startGame() {
    socket.emit('start-game');
}

const TOKEN_ICONS = { becak: '🚲', pinisi: '⛵', bajaj: '🛺', komodo: '🦎' };

socket.on('room-state', (state) => {
    const list = document.getElementById('players-list');
    list.innerHTML = '';

    state.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-card' + (p.id === myPlayerId ? ' me' : '');
        div.innerHTML = `
            <span class="player-token">${TOKEN_ICONS[p.token] || '?'}</span>
            <span class="player-name">${p.name}</span>
            ${p.id === state.hostId ? '<span class="badge host">HOST</span>' : ''}
            ${p.isBot ? '<span class="badge bot">BOT</span>' : ''}
        `;
        list.appendChild(div);
    });

    // Empty slots with waiting animation
    for (let i = state.players.length; i < 4; i++) {
        const div = document.createElement('div');
        div.className = 'player-card empty';
        div.innerHTML = '<span class="waiting">Menunggu pemain<span class="dots">...</span></span>';
        list.appendChild(div);
    }

    // Update host controls
    if (isHost) {
        document.getElementById('add-bot-btn').disabled = state.players.length >= 4;
        document.getElementById('start-btn').disabled = state.players.length < 2;
    }

    // Redirect when game starts
    if (state.state === 'playing') {
        window.location.href = `game.html?room=${currentRoom}&playerId=${myPlayerId}`;
    }
});

socket.on('game-log', ({ message }) => {
    const chat = document.getElementById('lobby-chat');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.textContent = message;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
});
