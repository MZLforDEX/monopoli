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
let p2pSocket = null;
let p2pFrameLaunched = false;

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

const PAWN_NAMES = {
  merah: 'Merah',
  biru: 'Biru',
  hijau: 'Hijau',
  kuning: 'Kuning'
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

function showError(msg, durationMs = 4500) {
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

function launchP2PGameFrame(code, playerId) {
  if (p2pFrameLaunched || !p2pSocket) return;
  p2pFrameLaunched = true;
  window.__monopoliP2PBridge = p2pSocket;
  document.body.dataset.state = 'playing';

  const frame = document.getElementById('game-frame');
  if (frame) {
    const q = new URLSearchParams({
      mode: 'p2p',
      room: code,
      playerId
    });
    frame.src = `game.html?${q.toString()}`;
    frame.classList.remove('hidden');
  }
}

function attachP2PListeners(p2pSock) {
  p2pSock.on('room-state', (state) => {
    renderLobbyPlayers(state.players, state.hostId);
    if (state.state === 'playing' && currentRoom && myPlayerId) {
      launchP2PGameFrame(currentRoom, myPlayerId);
    }
  });

  p2pSock.on('game-log', ({ message, timestamp }) => {
    appendLobbyChat(message, timestamp);
  });
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

function setModeBadge(text) {
  const badge = document.getElementById('connection-mode-badge');
  if (!badge) return;
  badge.textContent = text;
  badge.classList.remove('hidden');
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
        setModeBadge('🟢 Server Multiplayer Aktif');
      } else {
        showError((res && res.error) || 'Gagal membuat room');
      }
    });
    return;
  }

  // Fallback for static hosts (e.g., Vercel): Host-Authoritative WebRTC Room Code via PeerJS
  try {
    showError('Membuat room multiplayer...', 2000);
    const created = await window.P2PNetwork.createP2PHostRoom({ name, token: selectedToken });
    p2pSocket = created.socket;
    currentRoom = created.code;
    myPlayerId = created.playerId;
    isHost = true;
    attachP2PListeners(p2pSocket);
    showLobby();
    setModeBadge('🟣 Room P2P Langsung · Bagikan kode');
    const snap = p2pSocket.getInitialState();
    if (snap) renderLobbyPlayers(snap.players, snap.hostId);
    p2pSocket.getLogs().forEach(l => appendLobbyChat(l.message, l.timestamp));
  } catch (err) {
    showError(err.message || 'Gagal membuat room');
  }
}

async function joinRoom() {
  const name = validate(false);
  if (!name) return;
  const rawCode = document.getElementById('room-code').value;
  const code = window.P2PNetwork ? window.P2PNetwork.normalizeRoomCode(rawCode) : rawCode.trim().toUpperCase();
  if (!code) {
    showError('Masukkan kode room (contoh: NUS-ABC)!');
    return;
  }

  const online = await waitForServerStatus();
  if (online && socket) {
    socket.emit('join-room', { code, name, token: selectedToken }, (res) => {
      if (res && res.success) {
        currentRoom = res.code;
        myPlayerId = res.playerId;
        isHost = false;
        showLobby();
        setModeBadge('🟢 Server Multiplayer Aktif');
        if (res.tokenReassigned && res.assignedToken) {
          appendLobbyChat(`ℹ️ Pion pilihanmu sudah dipakai, otomatis memakai pion ${PAWN_NAMES[res.assignedToken] || res.assignedToken}.`);
        }
      } else {
        showError((res && res.error) || 'Gagal bergabung ke room');
      }
    });
    return;
  }

  // Fallback for static hosts (e.g., Vercel): Join Host's P2P WebRTC Room Code
  try {
    showError(`Menghubungkan ke Room ${code}...`, 3000);
    const joined = await window.P2PNetwork.joinP2PGuestRoom({ code, name, token: selectedToken });
    p2pSocket = joined.socket;
    currentRoom = joined.response.code;
    myPlayerId = joined.response.playerId;
    isHost = false;
    attachP2PListeners(p2pSocket);
    showLobby();
    setModeBadge('🟣 Terhubung ke Host Room');
    const snap = p2pSocket.getInitialState();
    if (snap) renderLobbyPlayers(snap.players, snap.hostId);
    p2pSocket.getLogs().forEach(l => appendLobbyChat(l.message, l.timestamp));
    if (joined.response.tokenReassigned && joined.response.assignedToken) {
      appendLobbyChat(`ℹ️ Pion pilihanmu sudah dipakai, otomatis memakai pion ${PAWN_NAMES[joined.response.assignedToken] || joined.response.assignedToken}.`);
    }
  } catch (err) {
    showError(err.message || 'Gagal bergabung ke room', 6000);
  }
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
    setTimeout(() => { el.textContent = '📋 Ketuk untuk salin kode room'; }, 2000);
  }
}

function copyInviteLink() {
  if (!currentRoom) return;
  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(currentRoom)}`;
  navigator.clipboard?.writeText(inviteUrl).catch(() => {});
  const btn = document.getElementById('copy-link-btn');
  if (btn) {
    btn.textContent = '✅ Link Undangan Disalin!';
    setTimeout(() => { btn.textContent = '🔗 Salin Link Undangan'; }, 2200);
  }
}

function addBot() {
  if (p2pSocket) {
    p2pSocket.emit('add-bot');
    return;
  }
  if (serverOnline && socket) {
    socket.emit('add-bot');
  }
}

function startGame() {
  if (p2pSocket) {
    p2pSocket.emit('start-game');
    return;
  }
  if (serverOnline && socket) {
    socket.emit('start-game');
  }
}

const seenLobbyChatKeys = new Set();

function appendLobbyChat(message, timestamp) {
  const chat = document.getElementById('lobby-chat');
  if (!chat || !message) return;
  if (timestamp) {
    const key = `${timestamp}|${message}`;
    if (seenLobbyChatKeys.has(key)) return;
    seenLobbyChatKeys.add(key);
  }
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
      div.innerHTML = '<span class="waiting">Slot Kosong · Bagikan kode room ke teman atau tambah Bot<span class="dots">...</span></span>';
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

// Support ?autostart=1 and ?room=NUS-XXX invite links
window.addEventListener('DOMContentLoaded', () => {
  document.body.dataset.state = 'title';
  const params = new URLSearchParams(window.location.search);
  const inviteRoom = params.get('room');
  if (inviteRoom) {
    const joinSec = document.getElementById('join-section');
    const codeInput = document.getElementById('room-code');
    const nameInput = document.getElementById('player-name');
    if (joinSec) joinSec.classList.remove('hidden');
    if (codeInput) {
      codeInput.value = window.P2PNetwork
        ? window.P2PNetwork.normalizeRoomCode(inviteRoom)
        : inviteRoom.trim().toUpperCase();
    }
    if (nameInput) {
      nameInput.value = '';
      nameInput.placeholder = 'Masukkan namamu untuk masuk room...';
      nameInput.focus();
    }
    return;
  }

  if (params.get('autostart') === '1') {
    quickStartGame();
  }
});
