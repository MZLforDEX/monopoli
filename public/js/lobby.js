const socket = io();
let selectedToken = 'merah';
let currentRoom = null;
let myPlayerId = null;
let isHost = false;

const PAWN_COLORS = {
  merah: '#ef4444',
  biru: '#38bdf8',
  hijau: '#10b981',
  kuning: '#facc15',
  becak: '#ef4444',
  pinisi: '#38bdf8',
  komodo: '#10b981',
  bajaj: '#facc15'
};

function renderPawnSvg(token, size = 24, idx = 0) {
  const palette = ['#ef4444', '#38bdf8', '#10b981', '#facc15'];
  const color = PAWN_COLORS[token] || palette[idx % palette.length];
  return `<svg class="pawn-svg" viewBox="0 0 36 44" width="${size}" height="${Math.round(size * 1.22)}" aria-hidden="true">
    <path d="M8 38 C8 33 12 31 13.5 28 L14.5 18 L12.5 16.5 C11.5 15.8 11.5 14.5 12.8 14 L23.2 14 C24.5 14.5 24.5 15.8 23.5 16.5 L21.5 18 L22.5 28 C24 31 28 33 28 38 Z" fill="${color}" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="18" cy="9" r="6.2" fill="${color}" stroke="#0f172a" stroke-width="2"/>
    <circle cx="16" cy="7.2" r="1.9" fill="rgba(255,255,255,0.5)"/>
  </svg>`;
}

function selectToken(el) {
  document.querySelectorAll('.token-card').forEach(c => {
    c.classList.remove('selected');
    c.setAttribute('aria-pressed', 'false');
  });
  el.classList.add('selected');
  el.setAttribute('aria-pressed', 'true');
  selectedToken = el.dataset.token;
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

function showJoinInput() {
  const joinSec = document.getElementById('join-section');
  if (!joinSec) return;
  joinSec.classList.toggle('hidden');
  if (!joinSec.classList.contains('hidden')) {
    document.getElementById('room-code')?.focus();
  }
}

function validate(allowDefaultName = false) {
  const input = document.getElementById('player-name');
  let name = input ? input.value.trim() : '';
  if (!name) {
    if (allowDefaultName) {
      name = 'Nakhoda';
      if (input) input.value = name;
    } else {
      showError('Masukkan nama pemain terlebih dahulu!');
      input?.focus();
      return null;
    }
  }
  if (!selectedToken) {
    selectedToken = 'merah';
  }
  return name;
}

function quickStartGame() {
  const name = validate(true);
  if (!name) return;
  document.body.dataset.state = 'playing';
  socket.emit('quick-start', { name, token: selectedToken, botCount: 3 }, (res) => {
    if (res && res.success) {
      window.location.href = `game.html?room=${res.code}&playerId=${res.playerId}`;
    } else {
      showError((res && res.error) || 'Gagal memulai permainan cepat');
    }
  });
}

function createRoom() {
  const name = validate(false);
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
  const name = validate(false);
  if (!name) return;
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  if (!code) {
    showError('Masukkan kode room (contoh: NUS-ABC)!');
    return;
  }
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
  if (!currentRoom) return;
  navigator.clipboard?.writeText(currentRoom).catch(() => {});
  const el = document.querySelector('.copy-hint');
  if (el) {
    el.textContent = '✅ Kode Tersalin!';
    setTimeout(() => { el.textContent = '📋 Ketuk untuk salin kode'; }, 2000);
  }
}

function addBot() {
  socket.emit('add-bot');
}

function startGame() {
  socket.emit('start-game');
}

socket.on('room-state', (state) => {
  const list = document.getElementById('players-list');
  if (list) {
    list.innerHTML = '';

    state.players.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'player-card' + (p.id === myPlayerId ? ' me' : '');
      div.innerHTML = `
        <span class="player-token">${renderPawnSvg(p.token, 24, idx)}</span>
        <span class="player-name">${p.name}</span>
        ${p.id === state.hostId ? '<span class="badge host">HOST</span>' : ''}
        ${p.isBot ? '<span class="badge bot">BOT AI</span>' : ''}
      `;
      list.appendChild(div);
    });

    for (let i = state.players.length; i < 4; i++) {
      const div = document.createElement('div');
      div.className = 'player-card empty';
      div.innerHTML = '<span class="waiting">Slot Kosong · Menunggu pemain atau Bot<span class="dots">...</span></span>';
      list.appendChild(div);
    }
  }

  if (isHost) {
    const addBotBtn = document.getElementById('add-bot-btn');
    const startBtn = document.getElementById('start-btn');
    if (addBotBtn) addBotBtn.disabled = state.players.length >= 4;
    if (startBtn) startBtn.disabled = state.players.length < 2;
  }

  if (state.state === 'playing' && currentRoom && myPlayerId) {
    window.location.href = `game.html?room=${currentRoom}&playerId=${myPlayerId}`;
  }
});

socket.on('game-log', ({ message }) => {
  const chat = document.getElementById('lobby-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.textContent = message;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
});

// Support ?autostart=1 and keyboard shortcut
window.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.state = 'title';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    quickStartGame();
  }
});
