const socket = io();
const params = new URLSearchParams(window.location.search);
const roomCode = params.get('room');
let myPlayerId = params.get('playerId');
window.myPlayerId = myPlayerId;
window.gameState = null;

let turnTimerInterval = null;

if (!roomCode || !myPlayerId) {
  window.location.href = '/';
}

// Rejoin room
socket.emit('rejoin', { roomCode, playerId: myPlayerId }, (res) => {
  if (res && res.newPlayerId) {
    myPlayerId = res.newPlayerId;
    window.myPlayerId = res.newPlayerId;
  }
});
document.getElementById('room-code-display').textContent = roomCode;

// Game state update
socket.on('room-state', (state) => {
  window.gameState = state;
  updatePlayersPanel(state.players, state.currentPlayerId, state.hostId);
  updatePlayerPositions(state.players);
  updateBuildings(state.boardState);
  updateMyProperties(state.players, state.boardState);
  updateTurnUI(state);
});

function updatePlayersPanel(players, currentPlayerId, hostId) {
  const panel = document.getElementById('players-panel');
  panel.innerHTML = '';
  
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player-info-card' + (p.id === currentPlayerId ? ' active-turn' : '') + (p.bankrupt ? ' bankrupt' : '');
    div.innerHTML = `
      <div class="player-header">
        <span class="player-token-large">${TOKEN_ICONS[p.token] || '?'}</span>
        <div>
          <span class="player-name-panel">${p.name}</span>
          ${p.isBot ? '<span class="badge-small bot">BOT</span>' : ''}
          ${p.id === myPlayerId ? '<span class="badge-small me">KAMU</span>' : ''}
        </div>
      </div>
      <div class="player-money">💰 Rp${p.money.toLocaleString()}rb</div>
      <div class="player-props-count">🏠 ${p.properties.length} properti</div>
      ${p.inJail ? '<div class="player-jail">🔒 Di Penjara</div>' : ''}
      ${p.bankrupt ? '<div class="player-bankrupt">💀 Bangkrut</div>' : ''}
    `;
    
    // Trade button for other players
    if (p.id !== myPlayerId && !p.bankrupt && !p.isBot) {
      const tradeBtn = document.createElement('button');
      tradeBtn.className = 'btn btn-tiny';
      tradeBtn.textContent = '🤝 Trade';
      tradeBtn.onclick = () => openTradeWith(p.id);
      div.appendChild(tradeBtn);
    }
    
    panel.appendChild(div);
  });
}

function updateTurnUI(state) {
  const current = state.players.find(p => p.id === state.currentPlayerId);
  document.getElementById('current-turn-name').textContent = current ? current.name : '-';
  
  const isMyTurn = state.currentPlayerId === myPlayerId;
  const rollBtn = document.getElementById('roll-btn');
  const endTurnBtn = document.getElementById('end-turn-btn');
  
  rollBtn.classList.toggle('hidden', !isMyTurn);
  rollBtn.disabled = !isMyTurn;
  endTurnBtn.classList.add('hidden');
  
  // Show jail modal if my turn and in jail
  if (isMyTurn && current && current.inJail) {
    showJailModal(current);
  }
  
  // Reset turn timer
  resetTurnTimer(isMyTurn);
}

function resetTurnTimer(isMyTurn) {
  clearInterval(turnTimerInterval);
  let timeLeft = 30;
  const timerEl = document.getElementById('turn-timer');
  timerEl.textContent = timeLeft;
  timerEl.classList.remove('timer-warning');
  
  turnTimerInterval = setInterval(() => {
    timeLeft--;
    timerEl.textContent = timeLeft;
    if (timeLeft <= 10) timerEl.classList.add('timer-warning');
    if (timeLeft <= 0) {
      clearInterval(turnTimerInterval);
      if (isMyTurn) {
        socket.emit('end-turn');
      }
    }
  }, 1000);
}

function rollDice() {
  const rollBtn = document.getElementById('roll-btn');
  rollBtn.disabled = true;
  SFX.play('dice');
  socket.emit('roll-dice');
}

function endTurn() {
  socket.emit('end-turn');
}

let is3DMode = true;

function toggleBoardMode() {
  is3DMode = !is3DMode;
  const wrapper3D = document.getElementById('canvas-3d-wrapper');
  const board2D = document.getElementById('game-board');
  const btn = document.getElementById('view-mode-btn');

  if (is3DMode) {
    wrapper3D.classList.remove('hidden');
    board2D.classList.add('hidden');
    if (btn) btn.textContent = '🌐 Mode: 3D HD';
    window.dispatchEvent(new Event('resize'));
  } else {
    wrapper3D.classList.add('hidden');
    board2D.classList.remove('hidden');
    if (btn) btn.textContent = '🗺️ Mode: 2D Flat';
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

// Dice result
socket.on('dice-result', async (data) => {
  const { playerId, dice, moveResult, inJail } = data;
  
  const onDiceFinished = async () => {
    if (moveResult && !inJail) {
      const player = window.gameState.players.find(p => p.id === playerId);
      if (player) {
        const fromPos = (moveResult.newPosition - dice.total + 40) % 40;
        if (typeof Board3D !== 'undefined' && Board3D.initialized && is3DMode) {
          await Board3D.animatePlayerMove3D(playerId, fromPos, moveResult.newPosition, window.gameState.players, () => {
            SFX.play('rent');
          });
        } else {
          await animatePlayerMove(playerId, fromPos, moveResult.newPosition, window.gameState.players);
        }
      }
    }
    
    // Show end turn button or roll button if it's my turn
    if (playerId === myPlayerId && !inJail) {
      if (dice.isDouble) {
        document.getElementById('roll-btn').classList.remove('hidden');
        document.getElementById('roll-btn').disabled = false;
        document.getElementById('end-turn-btn').classList.add('hidden');
      } else {
        document.getElementById('roll-btn').classList.add('hidden');
        document.getElementById('end-turn-btn').classList.remove('hidden');
      }
    }
  };

  if (typeof Board3D !== 'undefined' && Board3D.initialized && is3DMode) {
    Board3D.rollDice3D(dice.d1, dice.d2, onDiceFinished);
  } else {
    animateDice(dice.d1, dice.d2, onDiceFinished);
  }
});

// Buy option
socket.on('buy-option', ({ propertyId, space }) => {
  const modal = document.getElementById('buy-modal');
  document.getElementById('buy-modal-title').textContent = `Beli ${space.name}?`;
  document.getElementById('buy-modal-info').innerHTML = `
    <p style="color:${space.color || '#fff'}">■ ${space.name}</p>
    <p>Harga: <strong>Rp${space.price}rb</strong></p>
    <p>Sewa dasar: Rp${space.rent}rb</p>
    ${space.houseCost ? `<p>Harga rumah: Rp${space.houseCost}rb</p>` : ''}
  `;
  modal.classList.remove('hidden');
  SFX.play('buy');
});

function buyProperty(buy) {
  socket.emit('buy-property', { buy });
  document.getElementById('buy-modal').classList.add('hidden');
  document.getElementById('end-turn-btn').classList.remove('hidden');
}

// Card drawn
socket.on('card-drawn', ({ playerId, card, type }) => {
  if (playerId !== myPlayerId) return;
  const modal = document.getElementById('card-modal');
  document.getElementById('card-type-title').textContent = type === 'chance' ? '❓ Kesempatan' : '💳 Dana Umum';
  document.getElementById('card-text').textContent = card.text;
  document.getElementById('card-flip').classList.add('flipped');
  modal.classList.remove('hidden');
});

function closeCardModal() {
  document.getElementById('card-modal').classList.add('hidden');
  document.getElementById('card-flip').classList.remove('flipped');
}

// Auction
socket.on('auction-start', ({ propertyId, space }) => {
  showAuctionModal(propertyId, space);
});

socket.on('auction-update', (data) => {
  updateAuctionDisplay(data);
});

socket.on('auction-end', (result) => {
  closeAuction();
  if (result.winner) {
    const winner = window.gameState.players.find(p => p.id === result.winner);
    addLogMessage(`🔨 ${winner ? winner.name : 'Pemain'} memenangkan lelang!`);
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
    addLogMessage(accepted ? '🤝 Trade berhasil!' : '❌ Trade ditolak');
  }
});

// Bankrupt
socket.on('player-bankrupt', ({ playerId }) => {
  const player = window.gameState.players.find(p => p.id === playerId);
  if (playerId === myPlayerId) {
    addLogMessage('💀 Kamu bangkrut! Menjadi penonton...');
  }
  SFX.play('jail');
});

// Game over
socket.on('game-over', ({ winnerId }) => {
  const winner = window.gameState.players.find(p => p.id === winnerId);
  const modal = document.getElementById('gameover-modal');
  document.getElementById('winner-text').textContent = winnerId === myPlayerId 
    ? '🎉 Selamat! Kamu menang!' 
    : `${winner ? winner.name : 'Pemain'} memenangkan permainan!`;
  modal.classList.remove('hidden');
  SFX.play('win');
});

// Chat
socket.on('chat-message', ({ name, message }) => {
  addChatMessage(name, message);
});

socket.on('game-log', ({ message }) => {
  addLogMessage(message);
});

// Build actions
function buildHouse(propertyId) {
  socket.emit('build-house', { propertyId });
  SFX.play('buy');
}

function buildHotel(propertyId) {
  socket.emit('build-hotel', { propertyId });
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
  jailFreeBtn.style.display = player.jailFreeCards > 0 ? 'inline-block' : 'none';
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
