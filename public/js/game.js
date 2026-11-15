const params = new URLSearchParams(window.location.search);
let roomCode = params.get('room');
let myPlayerId = params.get('playerId');
const isAutoStart = params.get('autostart') === '1';
const isLocalMode = params.get('mode') === 'local' || typeof io === 'undefined';

function createSocketBridge() {
  const registeredListeners = [];
  let backend = isLocalMode
    ? window.createLocalMonopolySocket()
    : io({ timeout: 1800, reconnectionAttempts: 1 });
  let switchedToLocal = isLocalMode;

  function switchToLocal() {
    if (switchedToLocal || typeof window.createLocalMonopolySocket !== 'function') return false;
    switchedToLocal = true;
    try { backend.disconnect?.(); } catch (_) {}
    backend = window.createLocalMonopolySocket();
    registeredListeners.forEach(([event, fn]) => backend.on(event, fn));
    return true;
  }

  return {
    on(event, fn) {
      registeredListeners.push([event, fn]);
      backend.on(event, fn);
    },
    emit(event, payload, callback) {
      backend.emit(event, payload, callback);
    },
    switchToLocal,
    isLocal: () => switchedToLocal,
    getBackend: () => backend
  };
}

const socket = createSocketBridge();

window.myPlayerId = myPlayerId;
window.gameState = null;

let turnTimerInterval = null;
let lastTrackedTurnKey = '';
let isAnimatingTurn = false;
let activeMobileTab = 'board';
let pendingBuyOption = null;
let pendingCardDrawn = null;
let pendingLogs = [];
let cardModalCloseResolver = null;

document.body.dataset.state = 'playing';

function applyRoomStateToUI(state) {
  if (!state) return;
  updatePlayersPanel(state.players, state.currentPlayerId);
  updateMobilePlayerStrip(state.players, state.currentPlayerId);
  updatePlayerPositions(state.players);
  updateBuildings(state.boardState);
  updateMyProperties(state.players, state.boardState);
  updateTurnUI(state);
}

function startLocalGameFromParams() {
  const playerName = params.get('name') || 'Nakhoda';
  const token = params.get('token') || 'merah';
  const botCount = Number(params.get('bots')) || 3;
  socket.emit('quick-start', { name: playerName, token, botCount }, (res) => {
    if (res && res.success) {
      roomCode = res.code;
      myPlayerId = res.playerId;
      window.myPlayerId = res.playerId;
      const codeDisplay = document.getElementById('room-code-display');
      if (codeDisplay) codeDisplay.textContent = roomCode;
      if (Array.isArray(res.logs)) {
        res.logs.forEach(entry => addLogMessage(entry.message, entry.timestamp));
      }
    } else {
      window.location.href = '/';
    }
  });
}

function initRoomConnection() {
  if (isLocalMode) {
    startLocalGameFromParams();
    return;
  }

  const backend = socket.getBackend();
  let fallbackTriggered = false;
  const triggerLocalFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    if (socket.switchToLocal()) {
      startLocalGameFromParams();
    }
  };

  if (backend && typeof backend.on === 'function') {
    backend.on('connect_error', () => {
      if (isAutoStart || !roomCode) {
        triggerLocalFallback();
      }
    });
  }

  if (roomCode && myPlayerId) {
    const codeDisplay = document.getElementById('room-code-display');
    if (codeDisplay) codeDisplay.textContent = roomCode;

    socket.emit('rejoin', { roomCode, playerId: myPlayerId }, (res) => {
      if (res && res.error) {
        if (isAutoStart) {
          startQuickFallback();
        } else {
          window.location.href = '/';
        }
        return;
      }
      if (res && res.newPlayerId) {
        myPlayerId = res.newPlayerId;
        window.myPlayerId = res.newPlayerId;
        const newUrl = `${window.location.pathname}?room=${roomCode}&playerId=${myPlayerId}`;
        window.history.replaceState({}, '', newUrl);
      }
      if (res && Array.isArray(res.logs)) {
        res.logs.forEach(entry => addLogMessage(entry.message, entry.timestamp));
      }
    });
  } else if (isAutoStart) {
    startQuickFallback();
  } else {
    window.location.href = '/';
  }
}

function startQuickFallback() {
  socket.emit('quick-start', { name: 'Nakhoda', token: 'merah', botCount: 3 }, (res) => {
    if (res && res.success) {
      roomCode = res.code;
      myPlayerId = res.playerId;
      window.myPlayerId = res.playerId;
      const codeDisplay = document.getElementById('room-code-display');
      if (codeDisplay) codeDisplay.textContent = roomCode;
      const newUrl = `${window.location.pathname}?room=${roomCode}&playerId=${myPlayerId}`;
      window.history.replaceState({}, '', newUrl);
      if (Array.isArray(res.logs)) {
        res.logs.forEach(entry => addLogMessage(entry.message, entry.timestamp));
      }
    } else {
      window.location.href = '/';
    }
  });
}

initRoomConnection();

socket.on('room-state', (state) => {
  const isFirstState = !window.gameState;
  window.gameState = state;

  // Do not snap player tokens or overwrite turn controls while dice/token movement is animating!
  if (isAnimatingTurn && !isFirstState) {
    return;
  }

  applyRoomStateToUI(state);

  if (state.lastDice && !isAnimatingTurn) {
    showDiceReadout(state.lastDice.d1, state.lastDice.d2, false);
  }
});

function updatePlayersPanel(players, currentPlayerId) {
  const panel = document.getElementById('players-panel');
  if (!panel) return;
  panel.innerHTML = '';

  players.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'player-info-card' +
      (p.id === currentPlayerId ? ' active-turn' : '') +
      (p.bankrupt ? ' bankrupt' : '');

    const colorDot = typeof getPawnColor === 'function' ? getPawnColor(p.token, idx) : '#ef4444';
    const pawnHtml = typeof renderPawnSvg === 'function' ? renderPawnSvg(p.token, 22, idx) : '●';
    const cityName = (typeof boardData !== 'undefined' && boardData[p.position]) ? boardData[p.position].name : `Petak ${p.position}`;

    div.innerHTML = `
      <div class="player-header">
        <span class="player-token-avatar" style="border-color:${colorDot}">${pawnHtml}</span>
        <div class="player-meta">
          <div class="player-name-row">
            <span class="player-name-panel">${p.name}</span>
            ${p.id === myPlayerId ? '<span class="badge-small me">KAMU</span>' : ''}
            ${p.isBot ? '<span class="badge-small bot">AI</span>' : ''}
          </div>
          <span class="player-location">📍 ${cityName}</span>
        </div>
      </div>
      <div class="player-stats-row">
        <div class="player-money mono-num">${formatRupiah(p.money)}</div>
        <div class="player-props-count">${p.properties.length} Kota</div>
      </div>
      ${p.inJail ? '<div class="player-jail">🔒 Ditahan di Penjara</div>' : ''}
      ${p.bankrupt ? '<div class="player-bankrupt">💀 Bangkrut</div>' : ''}
    `;

    if (p.id !== myPlayerId && !p.bankrupt) {
      const tradeBtn = document.createElement('button');
      tradeBtn.type = 'button';
      tradeBtn.className = 'btn btn-tiny btn-trade-card';
      tradeBtn.textContent = '🤝 Ajukan Trade';
      tradeBtn.onclick = () => openTradeWith(p.id);
      div.appendChild(tradeBtn);
    }

    panel.appendChild(div);
  });
}

function updateMobilePlayerStrip(players, currentPlayerId) {
  const strip = document.getElementById('mobile-players-strip');
  if (!strip) return;
  strip.innerHTML = '';

  players.forEach((p, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mobile-player-chip' +
      (p.id === currentPlayerId ? ' active-turn' : '') +
      (p.id === myPlayerId ? ' is-me' : '') +
      (p.bankrupt ? ' bankrupt' : '');
    chip.onclick = () => switchMobileTab('players');
    const pawnHtml = typeof renderPawnSvg === 'function' ? renderPawnSvg(p.token, 16, idx) : '●';
    chip.innerHTML = `
      <span class="chip-token">${pawnHtml}</span>
      <span class="chip-info">
        <span class="chip-name">${p.name}</span>
        <span class="chip-money mono-num">${formatRupiah(p.money)}</span>
      </span>
    `;
    strip.appendChild(chip);
  });
}

function syncActionControls() {
  const state = window.gameState;
  if (!state) return;

  const isMyTurn = state.currentPlayerId === myPlayerId;
  const rollBtn = document.getElementById('roll-btn');
  const endTurnBtn = document.getElementById('end-turn-btn');
  const statusBanner = document.getElementById('turn-status-pill');

  if (!rollBtn || !endTurnBtn) return;

  if (isAnimatingTurn) {
    rollBtn.classList.add('hidden');
    endTurnBtn.classList.add('hidden');
    return;
  }

  if (isMyTurn) {
    if (state.turnPhase === 'roll') {
      rollBtn.classList.remove('hidden');
      rollBtn.disabled = false;
      endTurnBtn.classList.add('hidden');
      if (statusBanner) statusBanner.textContent = 'Giliranmu · Lempar Dadu!';
    } else if (state.turnPhase === 'end') {
      rollBtn.classList.add('hidden');
      endTurnBtn.classList.remove('hidden');
      endTurnBtn.disabled = false;
      if (statusBanner) statusBanner.textContent = 'Giliranmu · Kelola Kota atau Akhiri Giliran';
    } else if (state.turnPhase === 'buying') {
      rollBtn.classList.add('hidden');
      endTurnBtn.classList.add('hidden');
      if (statusBanner) statusBanner.textContent = 'Putuskan Pembelian Properti';
    } else if (state.turnPhase === 'auction') {
      rollBtn.classList.add('hidden');
      endTurnBtn.classList.add('hidden');
      if (statusBanner) statusBanner.textContent = 'Lelang Properti Berlangsung';
    }
  } else {
    rollBtn.classList.add('hidden');
    rollBtn.disabled = true;
    endTurnBtn.classList.add('hidden');
    const current = state.players.find(p => p.id === state.currentPlayerId);
    if (statusBanner) {
      statusBanner.textContent = current ? `Menunggu ${current.name}...` : 'Menunggu giliran...';
    }
  }
}

function updateTurnUI(state) {
  const current = state.players.find(p => p.id === state.currentPlayerId);
  const turnNameEl = document.getElementById('current-turn-name');
  if (turnNameEl) turnNameEl.textContent = current ? current.name : '-';

  const isMyTurn = state.currentPlayerId === myPlayerId;
  syncActionControls();

  const turnKey = `${state.currentPlayerId}:${state.turnPhase}`;
  if (turnKey !== lastTrackedTurnKey) {
    lastTrackedTurnKey = turnKey;
    if (isMyTurn && state.turnPhase === 'roll' && current && current.inJail) {
      showJailModal(current);
    }
    resetTurnTimer(isMyTurn);
  }
}

function resetTurnTimer(isMyTurn) {
  clearInterval(turnTimerInterval);
  let timeLeft = 30;
  const timerEl = document.getElementById('turn-timer');
  if (!timerEl) return;
  timerEl.textContent = timeLeft;
  timerEl.classList.remove('timer-warning');

  turnTimerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = Math.max(0, timeLeft);
    if (timeLeft <= 10) timerEl.classList.add('timer-warning');
    if (timeLeft <= 0) {
      clearInterval(turnTimerInterval);
      if (isMyTurn) {
        document.getElementById('buy-modal')?.classList.add('hidden');
        document.getElementById('jail-modal')?.classList.add('hidden');
        socket.emit('end-turn');
      }
    }
  }, 1000);
}

function rollDice() {
  const rollBtn = document.getElementById('roll-btn');
  if (rollBtn) rollBtn.disabled = true;
  document.getElementById('jail-modal')?.classList.add('hidden');
  pendingBuyOption = null;
  pendingCardDrawn = null;
  isAnimatingTurn = true;
  syncActionControls();
  SFX.play('dice');
  socket.emit('roll-dice');
}

function endTurn() {
  const endTurnBtn = document.getElementById('end-turn-btn');
  if (endTurnBtn) endTurnBtn.disabled = true;
  socket.emit('end-turn');
}

let is3DMode = true;

function toggleBoardMode() {
  is3DMode = !is3DMode;
  const wrapper3D = document.getElementById('canvas-3d-wrapper');
  const board2D = document.getElementById('game-board');
  const btn = document.getElementById('view-mode-btn');

  if (typeof Board3D !== 'undefined') {
    Board3D.enabled = is3DMode;
  }

  if (is3DMode) {
    wrapper3D.classList.remove('hidden');
    board2D.classList.add('hidden');
    if (btn) btn.textContent = '🌐 3D HD';
    if (typeof Board3D !== 'undefined' && Board3D.initialized) {
      Board3D.handleResize();
    }
  } else {
    wrapper3D.classList.add('hidden');
    board2D.classList.remove('hidden');
    if (btn) btn.textContent = '🗺️ 2D Peta';
  }
}

function set3DView(view, btnEl) {
  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.setCameraView(view);
  }
  document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

function toggle3DLight() {
  if (typeof Board3D !== 'undefined' && Board3D.initialized) {
    Board3D.toggleLighting();
  }
}

function switchMobileTab(tab) {
  activeMobileTab = tab;
  document.querySelectorAll('.mobile-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  const layout = document.querySelector('.game-layout');
  if (layout) {
    layout.dataset.mobileView = tab;
  }

  if (tab === 'board' && typeof Board3D !== 'undefined' && Board3D.initialized) {
    setTimeout(() => Board3D.handleResize(), 50);
  }
}

function toggleRulesModal(show) {
  const modal = document.getElementById('rules-modal');
  if (!modal) return;
  modal.classList.toggle('hidden', !show);
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTokenMoveWithStop(playerId, fromPos, toPos, playersSnapshot, stepDelta = 1) {
  if (fromPos === toPos) return;
  if (typeof Board3D !== 'undefined' && Board3D.initialized && is3DMode) {
    await Board3D.animatePlayerMove3D(playerId, fromPos, toPos, playersSnapshot, () => {
      SFX.play('rent');
    }, stepDelta);
  } else {
    await animatePlayerMove(playerId, fromPos, toPos, playersSnapshot, stepDelta);
  }
  // Keep 2D & 3D synced at the stopped tile and pause briefly so the stop is clearly visible
  const stoppedPlayers = (playersSnapshot || []).map(p => (p.id === playerId ? { ...p, position: toPos } : p));
  updatePlayerPositions(stoppedPlayers);
  await waitMs(280);
}

function flushPendingLogs() {
  while (pendingLogs.length > 0) {
    const entry = pendingLogs.shift();
    addLogMessage(entry.message, entry.timestamp);
  }
}

function presentBuyOptionModal({ playerId, space, canAfford }) {
  if (playerId && playerId !== myPlayerId) return;
  const modal = document.getElementById('buy-modal');
  if (!modal || !space) return;

  const meta = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getMeta(space)
    : { title: space.name };
  const artUrl = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getDataUrl(space, 640, 272)
    : '';

  document.getElementById('buy-modal-title').textContent = `Beli ${space.name}?`;
  document.getElementById('buy-modal-info').innerHTML = `
    <div class="buy-deed-preview" style="border-top: 5px solid ${space.color || '#fbbf24'}">
      ${artUrl ? `<img src="${artUrl}" alt="${meta.title}" class="modal-landmark-art">` : ''}
      <div class="modal-prop-header">
        <h4>${space.name}</h4>
        <span class="modal-landmark-sub">📍 ${meta.title}</span>
      </div>
      <div class="modal-stat-grid">
        <div class="modal-stat-row"><span>Harga Beli</span><strong class="mono-num">${formatRupiah(space.price)}</strong></div>
        ${space.rent ? `<div class="modal-stat-row"><span>Sewa Dasar</span><strong class="mono-num">${formatRupiah(space.rent)}</strong></div>` : ''}
        ${space.houseCost ? `<div class="modal-stat-row"><span>Biaya Rumah</span><strong class="mono-num">${formatRupiah(space.houseCost)}</strong></div>` : ''}
      </div>
    </div>
  `;
  const confirmBuyBtn = document.getElementById('confirm-buy-btn');
  if (confirmBuyBtn) {
    confirmBuyBtn.disabled = canAfford === false;
  }
  modal.classList.remove('hidden');
  SFX.play('buy');
}

function presentCardDrawnAsync({ playerId, playerName, card, type }) {
  if (playerId !== myPlayerId) {
    showToast(`🃏 ${playerName || 'Pemain'}: ${card.text}`, 'info');
    return waitMs(450);
  }
  return new Promise((resolve) => {
    cardModalCloseResolver = resolve;
    const modal = document.getElementById('card-modal');
    document.getElementById('card-type-title').textContent = type === 'chance' ? '❓ Kartu Kesempatan' : '💳 Kartu Dana Umum';
    document.getElementById('card-text').textContent = card.text;
    document.getElementById('card-flip').classList.add('flipped');
    modal.classList.remove('hidden');
  });
}

// Dice result — orchestrates Dice Roll -> Token Hop -> Token Stop -> Popups
socket.on('dice-result', async (data) => {
  const { playerId, dice, moveResult, inJail } = data;
  isAnimatingTurn = true;
  syncActionControls();
  showDiceReadout(dice.d1, dice.d2, true);

  const onDiceFinished = async () => {
    showDiceReadout(dice.d1, dice.d2, false);

    if (moveResult && !inJail && window.gameState) {
      const fromPos = typeof moveResult.fromPosition === 'number'
        ? moveResult.fromPosition
        : (moveResult.newPosition - dice.total + 40) % 40;

      // 1. Move token step-by-step to the rolled tile and wait for it to stop
      await runTokenMoveWithStop(playerId, fromPos, moveResult.newPosition, window.gameState.players);

      flushPendingLogs();

      // 2. If the tile triggered a Chance/Community card, show card AFTER token stopped on card tile
      if (pendingCardDrawn && pendingCardDrawn.playerId === playerId) {
        const cardData = pendingCardDrawn;
        pendingCardDrawn = null;
        await presentCardDrawnAsync(cardData);
      }

      // 3. Check if card or Go-To-Jail moved the player to a second destination tile
      const latestPlayer = window.gameState
        ? window.gameState.players.find(p => p.id === playerId)
        : null;
      const finalPosition = latestPlayer ? latestPlayer.position : moveResult.newPosition;

      if (finalPosition !== moveResult.newPosition && window.gameState) {
        if (latestPlayer && latestPlayer.inJail && finalPosition === 10) {
          updatePlayerPositions(window.gameState.players);
          await waitMs(280);
        } else {
          const backDist = (moveResult.newPosition - finalPosition + 40) % 40;
          const stepDelta = backDist === 3 ? -1 : 1;
          await runTokenMoveWithStop(playerId, moveResult.newPosition, finalPosition, window.gameState.players, stepDelta);
        }
      }

      if (playerId === myPlayerId && typeof showTileInfo === 'function') {
        showTileInfo(finalPosition, false);
        if (typeof Board3D !== 'undefined' && Board3D.initialized) {
          Board3D.selectedTileIndex = finalPosition;
        }
      }
    } else {
      await waitMs(250);
      flushPendingLogs();
    }

    // 4. Token has completely stopped: sync board & HUD state
    isAnimatingTurn = false;
    if (window.gameState) {
      applyRoomStateToUI(window.gameState);
    } else {
      syncActionControls();
    }

    // 5. Present any remaining queued Card or Buy Option popup AFTER token stopped
    if (pendingCardDrawn) {
      const cardData = pendingCardDrawn;
      pendingCardDrawn = null;
      await presentCardDrawnAsync(cardData);
    }

    if (pendingBuyOption) {
      const buyData = pendingBuyOption;
      pendingBuyOption = null;
      presentBuyOptionModal(buyData);
    }
  };

  if (typeof Board3D !== 'undefined' && Board3D.initialized && is3DMode) {
    Board3D.rollDice3D(dice.d1, dice.d2, onDiceFinished);
  } else {
    animateDice(dice.d1, dice.d2, onDiceFinished);
  }
});

// Buy option (queued if token is still moving)
socket.on('buy-option', (payload) => {
  if (payload.playerId && payload.playerId !== myPlayerId) return;
  if (isAnimatingTurn) {
    pendingBuyOption = payload;
    return;
  }
  presentBuyOptionModal(payload);
});

function buyProperty(buy) {
  document.getElementById('buy-modal').classList.add('hidden');
  socket.emit('buy-property', { buy });
}

// Card drawn (queued if token is still moving)
socket.on('card-drawn', (payload) => {
  if (isAnimatingTurn) {
    pendingCardDrawn = payload;
    return;
  }
  presentCardDrawnAsync(payload);
});

function closeCardModal() {
  document.getElementById('card-modal').classList.add('hidden');
  document.getElementById('card-flip').classList.remove('flipped');
  if (cardModalCloseResolver) {
    const resolve = cardModalCloseResolver;
    cardModalCloseResolver = null;
    resolve();
  }
}

// Auction
socket.on('auction-start', ({ propertyId, space, auctionState }) => {
  showAuctionModal(propertyId, space, auctionState);
});

socket.on('auction-update', (data) => {
  updateAuctionDisplay(data);
});

socket.on('auction-end', (result) => {
  closeAuction();
  if (result.winner && window.gameState) {
    const winner = window.gameState.players.find(p => p.id === result.winner);
    showToast(`🔨 ${winner ? winner.name : 'Pemain'} memenangkan lelang!`, 'success');
  }
});

// Trade
socket.on('trade-proposal', ({ fromId, toId, offer }) => {
  if (toId === myPlayerId) {
    showTradeProposal(fromId, offer);
  }
});

socket.on('trade-result', ({ accepted, fromId, toId }) => {
  if (fromId === myPlayerId || toId === myPlayerId) {
    showToast(accepted ? '🤝 Trade disetujui!' : '❌ Trade ditolak', accepted ? 'success' : 'info');
  }
});

// Bankrupt
socket.on('player-bankrupt', ({ playerId }) => {
  if (playerId === myPlayerId) {
    showToast('💀 Kamu bangkrut! Menjadi penonton...', 'error');
  }
  SFX.play('jail');
});

// Game over
socket.on('game-over', ({ winnerId }) => {
  document.body.dataset.state = 'gameover';
  clearInterval(turnTimerInterval);
  const winner = window.gameState ? window.gameState.players.find(p => p.id === winnerId) : null;
  const modal = document.getElementById('gameover-modal');
  document.getElementById('winner-text').textContent = winnerId === myPlayerId
    ? '🎉 Selamat! Kamu menguasai ekonomi Nusantara!'
    : `🏆 ${winner ? winner.name : 'Pemain'} memenangkan permainan!`;
  modal.classList.remove('hidden');
  SFX.play('win');
});

// Chat & Log
socket.on('chat-message', ({ name, message }) => {
  addChatMessage(name, message);
});

socket.on('game-log', ({ message, timestamp }) => {
  if (isAnimatingTurn) {
    pendingLogs.push({ message, timestamp });
    return;
  }
  addLogMessage(message, timestamp);
});

// Build & Mortgage actions
function buildHouse(propertyId) {
  socket.emit('build-house', { propertyId });
  SFX.play('buy');
}

function buildHotel(propertyId) {
  socket.emit('build-hotel', { propertyId });
  SFX.play('buy');
}

function sellBuilding(propertyId) {
  socket.emit('sell-building', { propertyId });
  SFX.play('buy');
}

function mortgageProperty(propertyId) {
  socket.emit('mortgage', { propertyId });
}

function unmortgageProperty(propertyId) {
  socket.emit('unmortgage', { propertyId });
}

// Jail
function showJailModal(player) {
  const modal = document.getElementById('jail-modal');
  const jailFreeBtn = document.getElementById('jail-free-btn');
  if (jailFreeBtn) {
    jailFreeBtn.style.display = player.jailFreeCards > 0 ? 'inline-flex' : 'none';
  }
  modal.classList.remove('hidden');
}

function payJail() {
  socket.emit('pay-jail');
  document.getElementById('jail-modal').classList.add('hidden');
}

function useJailFree() {
  socket.emit('use-jail-free');
  document.getElementById('jail-modal').classList.add('hidden');
}

function closeJailModal() {
  document.getElementById('jail-modal').classList.add('hidden');
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
