let boardData = [];
let currentlySelectedTile = 1;

const TILE_POSITIONS = {};
// Bottom row (row 11): START=0 at col 11, going left to col 1
for (let i = 0; i <= 10; i++) TILE_POSITIONS[i] = { row: 11, col: 11 - i };
// Left column (col 1): tiles 11-19, going up from row 10 to row 2
for (let i = 11; i <= 19; i++) TILE_POSITIONS[i] = { row: 10 - (i - 11), col: 1 };
// Top row (row 1): tiles 20-30, going right from col 1 to col 11
for (let i = 20; i <= 30; i++) TILE_POSITIONS[i] = { row: 1, col: i - 19 };
// Right column (col 11): tiles 31-39, going down from row 2 to row 10
for (let i = 31; i <= 39; i++) TILE_POSITIONS[i] = { row: i - 29, col: 11 };

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
const PLAYER_COLORS = ['#ef4444', '#38bdf8', '#10b981', '#facc15'];

function getPawnColor(token, idx = 0) {
  return PAWN_COLORS[token] || PLAYER_COLORS[idx % PLAYER_COLORS.length];
}

function renderPawnSvg(token, size = 20, idx = 0) {
  const color = getPawnColor(token, idx);
  return `<svg class="pawn-svg" viewBox="0 0 36 44" width="${size}" height="${Math.round(size * 1.22)}" aria-hidden="true">
    <path d="M8 38 C8 33 12 31 13.5 28 L14.5 18 L12.5 16.5 C11.5 15.8 11.5 14.5 12.8 14 L23.2 14 C24.5 14.5 24.5 15.8 23.5 16.5 L21.5 18 L22.5 28 C24 31 28 33 28 38 Z" fill="${color}" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="18" cy="9" r="6.2" fill="${color}" stroke="#0f172a" stroke-width="2.2"/>
    <circle cx="16" cy="7.2" r="1.9" fill="rgba(255,255,255,0.5)"/>
  </svg>`;
}

async function loadBoardData() {
  const res = await fetch('/data/properties.json');
  boardData = await res.json();
  renderBoard();

  if (typeof Board3D !== 'undefined') {
    Board3D.init();
    Board3D.populateTiles(boardData);
  }

  showTileInfo(1, false);

  if (window.gameState) {
    if (typeof updatePlayerPositions === 'function') updatePlayerPositions(window.gameState.players);
    if (typeof updateBuildings === 'function') updateBuildings(window.gameState.boardState);
    if (typeof updateMyProperties === 'function') updateMyProperties(window.gameState.players, window.gameState.boardState);
  }
}

function renderBoard() {
  const board = document.getElementById('game-board');
  if (!board) return;
  board.innerHTML = '';

  // Center 2D Board Hub (rows 2..10, cols 2..10)
  const centerHub = document.createElement('div');
  centerHub.className = 'board-2d-center';
  centerHub.innerHTML = `
    <div class="board-2d-deck deck-chance">❓<span>KESEMPATAN</span></div>
    <div class="board-2d-emblem">
      <div class="emblem-kicker">EDISI KEPULAUAN</div>
      <div class="emblem-title">MONOPOLI<span>NUSANTARA</span></div>
    </div>
    <div class="board-2d-deck deck-community">💳<span>DANA UMUM</span></div>
  `;
  board.appendChild(centerHub);

  boardData.forEach((tile, index) => {
    const pos = TILE_POSITIONS[index];
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tile tile-${tile.type}`;
    el.id = `tile-${index}`;
    el.style.gridRow = pos.row;
    el.style.gridColumn = pos.col;
    el.dataset.id = index;
    el.setAttribute('aria-label', `Petak ${tile.name}`);
    el.onclick = () => showTileInfo(index, true);

    const isCorner = [0, 10, 20, 30].includes(index);
    if (isCorner) el.classList.add('tile-corner');

    let orientation = '';
    if (pos.row === 11) orientation = 'bottom';
    else if (pos.row === 1) orientation = 'top';
    else if (pos.col === 1) orientation = 'left';
    else if (pos.col === 11) orientation = 'right';
    el.dataset.orientation = orientation;

    let colorBar = '';
    if (tile.type === 'property' && tile.color) {
      colorBar = `<div class="tile-color" style="background:${tile.color}"></div>`;
    }

    const buildings = `<div class="tile-buildings" id="buildings-${index}"></div>`;
    const ownerDot = `<div class="tile-owner-bar" id="owner-bar-${index}"></div>`;

    const meta = typeof NusantaraLandmarks !== 'undefined'
      ? NusantaraLandmarks.getMeta(tile)
      : { shortName: tile.name, title: tile.name };
    const artUrl = typeof NusantaraLandmarks !== 'undefined'
      ? NusantaraLandmarks.getDataUrl(tile, 320, 200)
      : '';

    const displayName = meta.shortName || tile.name;
    const priceDisplay = tile.price ? `<span class="tile-price mono-num">Rp${tile.price}rb</span>` : '';

    el.title = `${tile.name} — ${meta.title}`;
    el.innerHTML = `
      ${colorBar}
      ${ownerDot}
      <div class="tile-content">
        <span class="tile-name">${displayName}</span>
        ${artUrl ? `<img class="tile-art" src="${artUrl}" alt="${meta.title}" loading="lazy">` : ''}
        ${priceDisplay}
      </div>
      ${buildings}
      <div class="tile-players" id="players-on-${index}"></div>
    `;

    board.appendChild(el);
  });
}

function updatePlayerPositions(players) {
  document.querySelectorAll('.tile-players').forEach(el => { el.innerHTML = ''; });

  players.forEach((p, idx) => {
    if (p.bankrupt) return;
    const container = document.getElementById(`players-on-${p.position}`);
    if (!container) return;
    const marker = document.createElement('span');
    marker.className = 'player-marker';
    marker.innerHTML = renderPawnSvg(p.token, 13, idx);
    marker.title = p.name;
    container.appendChild(marker);
  });

  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.updatePlayers(players);
  }
}

function updateBuildings(boardState) {
  const players = window.gameState ? window.gameState.players : [];

  for (const [id, state] of Object.entries(boardState)) {
    const container = document.getElementById(`buildings-${id}`);
    if (container) {
      container.innerHTML = '';
      if (state.hotel) {
        container.innerHTML = '<span class="building hotel">🏨</span>';
      } else if (state.houses > 0) {
        for (let i = 0; i < state.houses; i++) {
          container.innerHTML += '<span class="building house">🏠</span>';
        }
      }
    }

    const tile = document.getElementById(`tile-${id}`);
    if (tile) {
      tile.classList.toggle('mortgaged', Boolean(state.mortgaged));
    }

    const ownerBar = document.getElementById(`owner-bar-${id}`);
    if (ownerBar) {
      if (state.ownerId) {
        const ownerIdx = players.findIndex(p => p.id === state.ownerId);
        const ownerPlayer = players[ownerIdx];
        ownerBar.style.background = getPawnColor(ownerPlayer && ownerPlayer.token, Math.max(0, ownerIdx));
        ownerBar.style.display = 'block';
      } else {
        ownerBar.style.display = 'none';
      }
    }
  }

  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.updateBuildings(boardState, players);
  }

  if (currentlySelectedTile !== null) {
    showTileInfo(currentlySelectedTile, false);
  }
}

function canClientBuildHouse(playerId, propertyId, boardState) {
  const space = boardData[propertyId];
  if (!space || space.type !== 'property') return false;
  const groupProps = boardData.filter(p => p.group === space.group).map(p => p.id);
  const ownsAll = groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged);
  if (!ownsAll) return false;
  const state = boardState[propertyId];
  if (!state || state.hotel || state.houses >= 4 || state.mortgaged) return false;
  const currentHouses = groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses);
  return state.houses <= Math.min(...currentHouses);
}

function canClientBuildHotel(playerId, propertyId, boardState) {
  const space = boardData[propertyId];
  if (!space || space.type !== 'property') return false;
  const state = boardState[propertyId];
  if (!state || state.ownerId !== playerId || state.mortgaged || state.hotel || state.houses < 4) return false;
  const groupProps = boardData.filter(p => p.group === space.group).map(p => p.id);
  const currentLevels = groupProps.map(id => boardState[id] ? (boardState[id].hotel ? 5 : boardState[id].houses) : 0);
  return Math.min(...currentLevels) >= 4;
}

function canClientSellBuilding(playerId, propertyId, boardState) {
  const space = boardData[propertyId];
  if (!space || space.type !== 'property') return false;
  const state = boardState[propertyId];
  if (!state || state.ownerId !== playerId) return false;
  const myLevel = state.hotel ? 5 : state.houses;
  if (myLevel <= 0) return false;
  const groupProps = boardData.filter(p => p.group === space.group).map(p => p.id);
  const currentLevels = groupProps.map(id => boardState[id] ? (boardState[id].hotel ? 5 : boardState[id].houses) : 0);
  return myLevel >= Math.max(...currentLevels);
}

function showTileInfo(index, fromUserClick = false) {
  currentlySelectedTile = index;
  const tile = boardData[index];
  const infoEl = document.getElementById('property-info');
  if (!tile || !infoEl) return;

  document.querySelectorAll('.tile.selected-tile').forEach(el => el.classList.remove('selected-tile'));
  const domTile = document.getElementById(`tile-${index}`);
  if (domTile) domTile.classList.add('selected-tile');

  const state = window.gameState && window.gameState.boardState ? window.gameState.boardState[index] : null;
  const owner = state && state.ownerId && window.gameState
    ? window.gameState.players.find(p => p.id === state.ownerId)
    : null;

  const typeLabels = {
    'property': 'Properti Kota',
    'airport': 'Bandara Nasional',
    'utility': 'BUMN Utilitas',
    'tax': 'Pajak Negara',
    'chance': 'Kartu Kesempatan',
    'community': 'Kartu Dana Umum',
    'start': 'Petak Awal',
    'jail-visit': 'Penjara / Kunjungan',
    'free-parking': 'Zona Istirahat',
    'go-to-jail': 'Perintah Penahanan'
  };

  let headerBg = tile.color || '#334155';
  if (tile.type === 'airport') headerBg = '#0284c7';
  if (tile.type === 'utility') headerBg = '#ca8a04';
  if (tile.type === 'tax') headerBg = '#dc2626';

  const meta = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getMeta(tile)
    : { title: tile.name };
  const bannerUrl = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getDataUrl(tile, 640, 296)
    : '';

  let html = `
    <div class="deed-card">
      <div class="deed-header" style="background:${headerBg}">
        <span class="deed-kicker">${typeLabels[tile.type] || tile.type}</span>
        <h4 class="deed-title">${tile.name}</h4>
      </div>
      ${bannerUrl ? `
      <div class="deed-art-banner">
        <img src="${bannerUrl}" alt="${meta.title}" class="deed-art-img">
        <span class="deed-landmark-caption">📍 ${meta.title}</span>
      </div>` : ''}
      <div class="deed-body">
  `;

  if (tile.price) {
    const priceLabel = tile.type === 'tax' ? 'Nominal Pajak' : 'Harga Beli';
    html += `
      <div class="deed-price-row">
        <span>${priceLabel}</span>
        <strong class="mono-num">Rp${tile.price.toLocaleString('id-ID')}rb</strong>
      </div>
    `;
  }

  if (tile.type === 'property' && tile.rentMultipliers) {
    const activeLevel = state ? (state.hotel ? 5 : state.houses) : 0;
    html += `
      <div class="deed-rent-table">
        <div class="rent-row ${activeLevel === 0 ? 'active-rent' : ''}"><span>Sewa Tanah</span><span class="mono-num">Rp${tile.rent}rb</span></div>
        <div class="rent-row"><span>1 Grup Warna Lengkap</span><span class="mono-num">Rp${tile.rent * 2}rb</span></div>
        <div class="rent-row ${activeLevel === 1 ? 'active-rent' : ''}"><span>1 Rumah</span><span class="mono-num">Rp${(tile.rent * tile.rentMultipliers[1]).toLocaleString('id-ID')}rb</span></div>
        <div class="rent-row ${activeLevel === 2 ? 'active-rent' : ''}"><span>2 Rumah</span><span class="mono-num">Rp${(tile.rent * tile.rentMultipliers[2]).toLocaleString('id-ID')}rb</span></div>
        <div class="rent-row ${activeLevel === 3 ? 'active-rent' : ''}"><span>3 Rumah</span><span class="mono-num">Rp${(tile.rent * tile.rentMultipliers[3]).toLocaleString('id-ID')}rb</span></div>
        <div class="rent-row ${activeLevel === 4 ? 'active-rent' : ''}"><span>4 Rumah</span><span class="mono-num">Rp${(tile.rent * tile.rentMultipliers[4]).toLocaleString('id-ID')}rb</span></div>
        <div class="rent-row ${activeLevel === 5 ? 'active-rent' : ''}"><span>🏨 Hotel</span><span class="mono-num">Rp${(tile.rent * tile.rentMultipliers[5]).toLocaleString('id-ID')}rb</span></div>
      </div>
      <div class="deed-meta-row">
        <span>Biaya Bangun: <strong class="mono-num">Rp${tile.houseCost}rb</strong></span>
        <span>Gadai: <strong class="mono-num">Rp${Math.floor(tile.price / 2)}rb</strong></span>
      </div>
    `;
  } else if (tile.type === 'airport') {
    html += `
      <div class="deed-rent-table">
        <div class="rent-row"><span>1 Bandara</span><span class="mono-num">Rp250rb</span></div>
        <div class="rent-row"><span>2 Bandara</span><span class="mono-num">Rp500rb</span></div>
        <div class="rent-row"><span>3 Bandara</span><span class="mono-num">Rp1.000rb</span></div>
        <div class="rent-row"><span>4 Bandara</span><span class="mono-num">Rp2.000rb</span></div>
      </div>
    `;
  } else if (tile.type === 'utility') {
    html += `
      <div class="deed-rent-table">
        <div class="rent-row"><span>1 BUMN Utilitas</span><span class="mono-num">40× Angka Dadu</span></div>
        <div class="rent-row"><span>2 BUMN Utilitas</span><span class="mono-num">100× Angka Dadu</span></div>
      </div>
    `;
  } else {
    const descMap = {
      'start': 'Setiap melewati atau mendarat di START, terima gaji Rp2.000rb dari Bank.',
      'jail-visit': 'Hanya berkunjung jika mendarat normal. Jika ditahan, bayar Rp500rb atau lempar dadu kembar.',
      'free-parking': 'Zona istirahat bebas biaya. Nikmati perjalanan mengelilingi Nusantara!',
      'go-to-jail': 'Langsung menuju petak Penjara tanpa menerima gaji START.',
      'chance': 'Ambil 1 Kartu Kesempatan dan jalankan instruksi pada kartu.',
      'community': 'Ambil 1 Kartu Dana Umum dan jalankan instruksi pada kartu.',
      'tax': `Bayar kewajiban pajak sebesar Rp${(tile.price || 0).toLocaleString('id-ID')}rb ke Kas Negara.`
    };
    html += `<p class="deed-desc">${descMap[tile.type] || ''}</p>`;
  }

  if (state) {
    if (owner) {
      const ownerIdx = window.gameState ? window.gameState.players.findIndex(p => p.id === owner.id) : 0;
      html += `
        <div class="deed-owner-box">
          <span class="owner-inline">Pemilik: ${renderPawnSvg(owner.token, 14, Math.max(0, ownerIdx))} <strong>${owner.name}</strong></span>
          ${state.mortgaged ? '<span class="status-tag tag-danger">TERGADAI</span>' : ''}
        </div>
      `;
    } else {
      html += `<div class="deed-owner-box available">✨ Tersedia untuk dibeli</div>`;
    }
  }

  html += `</div></div>`;
  infoEl.innerHTML = html;

  updateActionButtons(index);

  // On mobile, if user explicitly tapped a tile, switch to Property tab so they see the deed card
  if (fromUserClick && window.innerWidth <= 860 && typeof switchMobileTab === 'function') {
    switchMobileTab('property');
  }
}

function updateActionButtons(tileIndex) {
  const actionsEl = document.getElementById('action-buttons');
  if (!actionsEl) return;
  actionsEl.innerHTML = '';

  if (!window.gameState || !window.myPlayerId) return;
  const state = window.gameState.boardState[tileIndex];
  if (!state || state.ownerId !== window.myPlayerId) return;
  const isMyTurn = window.gameState.currentPlayerId === window.myPlayerId;
  if (!isMyTurn) {
    actionsEl.innerHTML = `<p class="hint">Tunggu giliranmu untuk mengelola bangunan/gadai.</p>`;
    return;
  }

  const tile = boardData[tileIndex];
  const boardState = window.gameState.boardState;

  if (tile.type === 'property') {
    if (!state.mortgaged && !state.hotel && state.houses < 4) {
      const canBuild = canClientBuildHouse(window.myPlayerId, tileIndex, boardState);
      actionsEl.innerHTML += `
        <button type="button" class="btn btn-small btn-primary" ${canBuild ? '' : 'disabled title="Miliki seluruh warna dalam grup ini & bangun secara merata"'} onclick="buildHouse(${tileIndex})">
          🏠 Bangun Rumah (Rp${tile.houseCost}rb)
        </button>
      `;
    }
    if (!state.mortgaged && state.houses === 4 && !state.hotel) {
      const canHotel = canClientBuildHotel(window.myPlayerId, tileIndex, boardState);
      actionsEl.innerHTML += `
        <button type="button" class="btn btn-small btn-primary" ${canHotel ? '' : 'disabled title="Semua kota di grup ini harus memiliki 4 rumah"'} onclick="buildHotel(${tileIndex})">
          🏨 Bangun Hotel (Rp${tile.houseCost}rb)
        </button>
      `;
    }
    if (canClientSellBuilding(window.myPlayerId, tileIndex, boardState)) {
      const refund = Math.floor(tile.houseCost / 2);
      actionsEl.innerHTML += `
        <button type="button" class="btn btn-small btn-secondary" onclick="sellBuilding(${tileIndex})">
          💰 Jual Bangunan (+Rp${refund}rb)
        </button>
      `;
    }
  }

  if (!state.mortgaged && state.houses === 0 && !state.hotel) {
    const mortgageVal = Math.floor(tile.price / 2);
    actionsEl.innerHTML += `
      <button type="button" class="btn btn-small btn-secondary" onclick="mortgageProperty(${tileIndex})">
        💳 Gadai (+Rp${mortgageVal}rb)
      </button>
    `;
  }
  if (state.mortgaged) {
    const cost = Math.floor(Math.floor(tile.price / 2) * 1.1);
    actionsEl.innerHTML += `
      <button type="button" class="btn btn-small btn-primary" onclick="unmortgageProperty(${tileIndex})">
        🔓 Tebus Properti (Rp${cost}rb)
      </button>
    `;
  }
}

function updateMyProperties(players, boardState) {
  const list = document.getElementById('my-properties-list');
  const countBadge = document.getElementById('my-props-badge');
  if (!list || !window.myPlayerId) return;
  const me = players.find(p => p.id === window.myPlayerId);
  if (!me) return;

  if (countBadge) countBadge.textContent = me.properties.length;

  list.innerHTML = '';
  me.properties.forEach(id => {
    const tile = boardData[id];
    if (!tile) return;
    const state = boardState[id];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'my-prop-item' + (state.mortgaged ? ' mortgaged' : '') + (currentlySelectedTile === id ? ' active' : '');
    btn.onclick = () => {
      showTileInfo(id, false);
      if (typeof Board3D !== 'undefined' && Board3D.initialized) {
        Board3D.selectTile(id);
      }
    };
    btn.innerHTML = `
      <span class="prop-color" style="background:${tile.color || '#38bdf8'}"></span>
      <span class="prop-name">${tile.name}</span>
      <span class="prop-buildings">${state.mortgaged ? '⚠️' : state.hotel ? '🏨' : state.houses > 0 ? '🏠×' + state.houses : ''}</span>
    `;
    list.appendChild(btn);
  });

  if (me.properties.length === 0) {
    list.innerHTML = '<p class="hint">Belum memiliki properti. Lempar dadu dan beli kota pertamamu!</p>';
  }
}

loadBoardData();
