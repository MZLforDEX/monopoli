const forceLocalTest = new URLSearchParams(window.location.search).get('localtest') === '1';
const socket = (!forceLocalTest && typeof io !== 'undefined')
  ? io({ timeout: 1500, reconnectionAttempts: 1 })
  : null;

let serverOnline = false;
let serverChecked = !socket;
let serverCheckWaiters = [];

function resolveServerWaiters() {
  const waiters = serverCheckWaiters;
  serverCheckWaiters = [];
  waiters.forEach(fn => fn(serverOnline));
}

if (socket) {
  socket.on('connect', () => {
    serverOnline = true;
    serverChecked = true;
    resolveServerWaiters();
  });
  socket.on('connect_error', () => {
    serverOnline = false;
    serverChecked = true;
    resolveServerWaiters();
  });
  setTimeout(() => {
    if (!serverChecked) {
      serverChecked = true;
      resolveServerWaiters();
    }
  }, 1500);
}

function waitForServerStatus() {
  if (serverChecked) return Promise.resolve(serverOnline);
  return new Promise(resolve => {
    serverCheckWaiters.push(resolve);
  });
}

let selectedToken = 'merah';
let currentRoom = null;
let myPlayerId = null;
let isHost = false;
let localLobbyPlayers = [];

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

function showError(msg, durationMs = 4000) {
  const el = document.getElementById('error-msg');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), durationMs);
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

function launchLocalGame(name, token, botCount = 3) {
  const q = new URLSearchParams({
    mode: 'local',
    name: name || 'Nakhoda',
    token: token || 'merah',
    bots: String(Math.min(3, Math.max(1, botCount || 3)))
  });
  window.location.href = `game.html?${q.toString()}`;
}

async function quickStartGame() {
  const name = validate(true);
  if (!name) return;
  document.body.dataset.state = 'playing';

  const online = await waitForServerStatus();
  if (online && socket) {
    socket.emit('quick-start', { name, token: selectedToken, botCount: 3 }, (res) => {
      if (res && res.success) {
        window.location.href = `game.html?room=${res.code}&playerId=${res.playerId}`;
      } else {
        launchLocalGame(name, selectedToken, 3);
      }
    });
  } else {
    launchLocalGame(name, selectedToken, 3);
  }
}

async function createRoom() {
  const name = validate(false);
  if (!name) return;

  const online = await waitForServerStatus();
  if (online && socket) {
    socket.emit('create-room', { name, token: selectedToken }, (res) => {
      if (res && res.success) {
        currentRoom = res.code;
        myPlayerId = res.playerId;
        isHost = true;
        showLobby();
      } else {
        showError((res && res.error) || 'Gagal membuat room');
      }
    });
  } else {
    currentRoom = 'LOCAL-SOLO';
    myPlayerId = 'local-player-1';
    isHost = true;
    localLobbyPlayers = [
      { id: myPlayerId, name, token: selectedToken, isBot: false }
    ];
    showLobby();
    renderLobbyPlayers(localLobbyPlayers, myPlayerId);
    appendLobbyChat('ℹ️ Mode Lokal aktif (hosting statis): tambahkan 1–3 Bot AI lalu klik Mulai Permainan.');
  }
}

async function joinRoom() {
  const name = validate(false);
  if (!name) return;
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  if (!code) {
    showError('Masukkan kode room (contoh: NUS-ABC)!');
    return;
  }

  const online = await waitForServerStatus();
  if (!online || !socket) {
    showError('Gabung Room antar perangkat membutuhkan server Node.js/Socket.IO aktif. Gunakan "Main Cepat vs 3 Bot AI" atau "Buat Room" untuk langsung bermain!', 6000);
    return;
  }

  socket.emit('join-room', { code, name, token: selectedToken }, (res) => {
    if (res && res.success) {
      currentRoom = res.code;
      myPlayerId = res.playerId;
      isHost = false;
      showLobby();
    } else {
      showError((res && res.error) || 'Gagal bergabung ke room');
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
  if (serverOnline && socket) {
    socket.emit('add-bot');
    return;
  }
  if (localLobbyPlayers.length >= 4) return;
  const botNames = ['Bot Garuda', 'Bot Komodo', 'Bot Rajawali', 'Bot Cendrawasih'];
  const tokens = ['merah', 'biru', 'hijau', 'kuning'];
  const usedTokens = localLobbyPlayers.map(p => p.token);
  const availToken = tokens.find(t => !usedTokens.includes(t));
  if (!availToken) return;
  const botName = botNames.find(n => !localLobbyPlayers.some(p => p.name === n)) || `Bot ${localLobbyPlayers.length + 1}`;
  localLobbyPlayers.push({
    id: `bot-local-${localLobbyPlayers.length}`,
    name: botName,
    token: availToken,
    isBot: true
  });
  renderLobbyPlayers(localLobbyPlayers, myPlayerId);
  appendLobbyChat(`🤖 ${botName} ditambahkan ke room`);
}

function startGame() {
  if (serverOnline && socket) {
    socket.emit('start-game');
    return;
  }
  const human = localLobbyPlayers[0];
  const botCount = Math.max(1, localLobbyPlayers.filter(p => p.isBot).length);
  launchLocalGame(human?.name || 'Nakhoda', human?.token || selectedToken, botCount);
}

function appendLobbyChat(message) {
  const chat = document.getElementById('lobby-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.textContent = message;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function renderLobbyPlayers(players, hostId) {
  const list = document.getElementById('players-list');
  if (list) {
    list.innerHTML = '';

    players.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = 'player-card' + (p.id === myPlayerId ? ' me' : '');
      div.innerHTML = `
        <span class="player-token">${renderPawnSvg(p.token, 24, idx)}</span>
        <span class="player-name">${p.name}</span>
        ${p.id === hostId ? '<span class="badge host">HOST</span>' : ''}
        ${p.isBot ? '<span class="badge bot">BOT AI</span>' : ''}
      `;
      list.appendChild(div);
    });

    for (let i = players.length; i < 4; i++) {
      const div = document.createElement('div');
      div.className = 'player-card empty';
      div.innerHTML = '<span class="waiting">Slot Kosong · Menunggu pemain atau Bot<span class="dots">...</span></span>';
      list.appendChild(div);
    }
  }

  if (isHost) {
    const addBotBtn = document.getElementById('add-bot-btn');
    const startBtn = document.getElementById('start-btn');
    if (addBotBtn) addBotBtn.disabled = players.length >= 4;
    if (startBtn) startBtn.disabled = players.length < 2;
  }
}

if (socket) {
  socket.on('room-state', (state) => {
    renderLobbyPlayers(state.players, state.hostId);

    if (state.state === 'playing' && currentRoom && myPlayerId) {
      window.location.href = `game.html?room=${currentRoom}&playerId=${myPlayerId}`;
    }
  });

  socket.on('game-log', ({ message }) => {
    appendLobbyChat(message);
  });
}

// Support ?autostart=1 and keyboard shortcut
window.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.state = 'title';
  const params = new URLSearchParams(window.location.search);
  if (params.get('autostart') === '1') {
    quickStartGame();
  }
});
