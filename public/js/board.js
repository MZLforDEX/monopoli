// Board tile positions mapped to CSS grid
// Bottom row: tiles 0-10 (right to left, row 11)
// Left column: tiles 11-19 (bottom to top, col 1)
// Top row: tiles 20-30 (left to right, row 1)
// Right column: tiles 31-39 (top to bottom, col 11)

let boardData = [];

const TILE_POSITIONS = {};
// Bottom row (row 11): START=0 at col 11, going left to col 1
for (let i = 0; i <= 10; i++) TILE_POSITIONS[i] = { row: 11, col: 11 - i };
// Left column (col 1): tiles 11-19, going up from row 10 to row 2
for (let i = 11; i <= 19; i++) TILE_POSITIONS[i] = { row: 10 - (i - 11), col: 1 };
// Top row (row 1): tiles 20-30, going right from col 1 to col 11
for (let i = 20; i <= 30; i++) TILE_POSITIONS[i] = { row: 1, col: i - 19 };
// Right column (col 11): tiles 31-39, going down from row 2 to row 10
for (let i = 31; i <= 39; i++) TILE_POSITIONS[i] = { row: i - 29, col: 11 };

const TOKEN_ICONS = { becak: '🚲', pinisi: '⛵', bajaj: '🛺', komodo: '🦎' };

async function loadBoardData() {
  const res = await fetch('/data/properties.json');
  boardData = await res.json();
  renderBoard();

  // Initialize and populate 3D Board
  if (typeof Board3D !== 'undefined') {
    Board3D.init();
    Board3D.populateTiles(boardData);
  }

  if (window.gameState) {
    if (typeof updatePlayerPositions === 'function') updatePlayerPositions(window.gameState.players);
    if (typeof updateBuildings === 'function') updateBuildings(window.gameState.boardState);
    if (typeof updateMyProperties === 'function') updateMyProperties(window.gameState.players, window.gameState.boardState);
  }
}

function renderBoard() {
  const board = document.getElementById('game-board');
  board.innerHTML = '';
  
  boardData.forEach((tile, index) => {
    const pos = TILE_POSITIONS[index];
    const el = document.createElement('div');
    el.className = `tile tile-${tile.type}`;
    el.id = `tile-${index}`;
    el.style.gridRow = pos.row;
    el.style.gridColumn = pos.col;
    el.dataset.id = index;
    el.onclick = () => showTileInfo(index);
    
    // Corner tiles are bigger
    const isCorner = [0, 10, 20, 30].includes(index);
    if (isCorner) el.classList.add('tile-corner');
    
    // Determine orientation for color bar
    let orientation = '';
    if (pos.row === 11) orientation = 'bottom';
    else if (pos.row === 1) orientation = 'top';
    else if (pos.col === 1) orientation = 'left';
    else if (pos.col === 11) orientation = 'right';
    el.dataset.orientation = orientation;
    
    // Color bar for properties
    let colorBar = '';
    if (tile.type === 'property' && tile.color) {
      colorBar = `<div class="tile-color" style="background:${tile.color}"></div>`;
    }
    
    // Buildings placeholder
    const buildings = `<div class="tile-buildings" id="buildings-${index}"></div>`;
    
    // Tile content
    const typeIcons = {
      'start': '🏁',
      'jail-visit': '🔒',
      'free-parking': '🅿️',
      'go-to-jail': '🚔',
      'chance': '❓',
      'community': '💳',
      'tax': '💸',
      'airport': '✈️',
      'utility': tile.name === 'PLN' ? '⚡' : '💧'
    };
    
    const icon = typeIcons[tile.type] || '';
    const displayName = tile.name.length > 12 ? tile.name.substring(0, 11) + '…' : tile.name;
    const priceDisplay = tile.price ? `<span class="tile-price">Rp${tile.price}rb</span>` : '';
    
    el.innerHTML = `
      ${colorBar}
      <div class="tile-content">
        <span class="tile-icon">${icon}</span>
        <span class="tile-name">${displayName}</span>
        ${priceDisplay}
      </div>
      ${buildings}
      <div class="tile-players" id="players-on-${index}"></div>
    `;
    
    board.appendChild(el);
  });
}

function updatePlayerPositions(players) {
  // Clear all player markers in 2D
  document.querySelectorAll('.tile-players').forEach(el => el.innerHTML = '');
  
  players.forEach(p => {
    if (p.bankrupt) return;
    const container = document.getElementById(`players-on-${p.position}`);
    if (!container) return;
    const marker = document.createElement('span');
    marker.className = 'player-marker';
    marker.textContent = TOKEN_ICONS[p.token] || '●';
    marker.title = p.name;
    container.appendChild(marker);
  });

  // Synchronize 3D tokens
  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.updatePlayers(players);
  }
}

function updateBuildings(boardState) {
  for (const [id, state] of Object.entries(boardState)) {
    const container = document.getElementById(`buildings-${id}`);
    if (!container) continue;
    container.innerHTML = '';
    if (state.hotel) {
      container.innerHTML = '<span class="building hotel">🏨</span>';
    } else if (state.houses > 0) {
      for (let i = 0; i < state.houses; i++) {
        container.innerHTML += '<span class="building house">🏠</span>';
      }
    }
    // Show mortgage indicator
    const tile = document.getElementById(`tile-${id}`);
    if (tile) {
      tile.classList.toggle('mortgaged', state.mortgaged);
    }
  }

  // Synchronize 3D houses & hotels
  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.updateBuildings(boardState);
  }
}

function showTileInfo(index) {
  const tile = boardData[index];
  const infoEl = document.getElementById('property-info');
  
  if (!tile) return;
  
  let html = `<h4 style="color:${tile.color || '#fff'}">${tile.name}</h4>`;
  html += `<p class="tile-type">${tile.type}</p>`;
  
  if (tile.price) {
    html += `<p>Harga: <strong>Rp${tile.price}rb</strong></p>`;
  }
  if (tile.rent) {
    html += `<p>Sewa dasar: Rp${tile.rent}rb</p>`;
  }
  if (tile.houseCost) {
    html += `<p>Harga rumah: Rp${tile.houseCost}rb</p>`;
  }
  
  // Show owner if owned
  if (window.gameState && window.gameState.boardState[index]) {
    const state = window.gameState.boardState[index];
    if (state.ownerId) {
      const owner = window.gameState.players.find(p => p.id === state.ownerId);
      html += `<p>Pemilik: <strong>${owner ? owner.name : 'Unknown'}</strong></p>`;
      html += `<p>Bangunan: ${state.hotel ? '🏨 Hotel' : state.houses > 0 ? '🏠'.repeat(state.houses) : 'Kosong'}</p>`;
      if (state.mortgaged) html += `<p class="mortgaged-label">⚠️ Tergadai</p>`;
    } else {
      html += `<p class="available">Belum dimiliki</p>`;
    }
  }
  
  infoEl.innerHTML = html;
  
  // Show action buttons for owned properties
  updateActionButtons(index);
}

function updateActionButtons(tileIndex) {
  const actionsEl = document.getElementById('action-buttons');
  actionsEl.innerHTML = '';
  
  if (!window.gameState || !window.myPlayerId) return;
  const state = window.gameState.boardState[tileIndex];
  if (!state || state.ownerId !== window.myPlayerId) return;
  if (window.gameState.currentPlayerId !== window.myPlayerId) return;
  
  const tile = boardData[tileIndex];
  
  if (tile.type === 'property') {
    if (!state.mortgaged && !state.hotel && state.houses < 4) {
      actionsEl.innerHTML += `<button class="btn btn-small btn-primary" onclick="buildHouse(${tileIndex})">🏠 Bangun Rumah (Rp${tile.houseCost}rb)</button>`;
    }
    if (!state.mortgaged && state.houses === 4 && !state.hotel) {
      actionsEl.innerHTML += `<button class="btn btn-small btn-primary" onclick="buildHotel(${tileIndex})">🏨 Bangun Hotel (Rp${tile.houseCost}rb)</button>`;
    }
  }
  
  if (!state.mortgaged && state.houses === 0 && !state.hotel) {
    actionsEl.innerHTML += `<button class="btn btn-small btn-secondary" onclick="mortgageProperty(${tileIndex})">💳 Gadai</button>`;
  }
  if (state.mortgaged) {
    const cost = Math.floor(tile.price / 2 * 1.1);
    actionsEl.innerHTML += `<button class="btn btn-small btn-primary" onclick="unmortgageProperty(${tileIndex})">🔓 Tebus (Rp${cost}rb)</button>`;
  }
}

function updateMyProperties(players, boardState) {
  const list = document.getElementById('my-properties-list');
  if (!list || !window.myPlayerId) return;
  const me = players.find(p => p.id === window.myPlayerId);
  if (!me) return;
  
  list.innerHTML = '';
  me.properties.forEach(id => {
    const tile = boardData[id];
    if (!tile) return;
    const state = boardState[id];
    const div = document.createElement('div');
    div.className = 'my-prop-item' + (state.mortgaged ? ' mortgaged' : '');
    div.onclick = () => showTileInfo(id);
    div.innerHTML = `
      <span class="prop-color" style="background:${tile.color || '#666'}"></span>
      <span class="prop-name">${tile.name}</span>
      ${state.hotel ? '🏨' : state.houses > 0 ? '🏠'.repeat(state.houses) : ''}
    `;
    list.appendChild(div);
  });
  
  if (me.properties.length === 0) {
    list.innerHTML = '<p class="hint">Belum punya properti</p>';
  }
}

loadBoardData();
