let tradeTarget = null;
let pendingTrade = null;

function openTradeWith(playerId) {
  if (!window.gameState) return;
  tradeTarget = playerId;
  const modal = document.getElementById('trade-modal');
  const target = window.gameState.players.find(p => p.id === playerId);
  const me = window.gameState.players.find(p => p.id === window.myPlayerId);
  if (!target || !me) return;
  
  // My properties
  const myPropsEl = document.getElementById('trade-my-props');
  myPropsEl.innerHTML = '';
  me.properties.forEach(id => {
    const tile = boardData[id];
    const state = window.gameState.boardState[id];
    if (state.houses > 0 || state.hotel) return; // Can't trade with buildings
    const div = document.createElement('label');
    div.className = 'trade-prop-item';
    div.innerHTML = `
      <input type="checkbox" value="${id}">
      <span class="prop-color" style="background:${tile.color || '#666'}"></span>
      ${tile.name}
    `;
    myPropsEl.appendChild(div);
  });
  
  // Their properties
  const theirPropsEl = document.getElementById('trade-their-props');
  theirPropsEl.innerHTML = '';
  target.properties.forEach(id => {
    const tile = boardData[id];
    const state = window.gameState.boardState[id];
    if (state.houses > 0 || state.hotel) return;
    const div = document.createElement('label');
    div.className = 'trade-prop-item';
    div.innerHTML = `
      <input type="checkbox" value="${id}">
      <span class="prop-color" style="background:${tile.color || '#666'}"></span>
      ${tile.name}
    `;
    theirPropsEl.appendChild(div);
  });
  
  document.getElementById('trade-my-money').value = 0;
  document.getElementById('trade-their-money').value = 0;
  modal.classList.remove('hidden');
}

function sendTrade() {
  const myProps = [...document.querySelectorAll('#trade-my-props input:checked')].map(el => parseInt(el.value));
  const theirProps = [...document.querySelectorAll('#trade-their-props input:checked')].map(el => parseInt(el.value));
  const myMoney = parseInt(document.getElementById('trade-my-money').value) || 0;
  const theirMoney = parseInt(document.getElementById('trade-their-money').value) || 0;
  
  const offer = {
    fromMoney: myMoney,
    toMoney: theirMoney,
    fromProperties: myProps,
    toProperties: theirProps
  };
  
  socket.emit('trade-offer', { toId: tradeTarget, offer });
  closeTrade();
}

function closeTrade() {
  document.getElementById('trade-modal').classList.add('hidden');
  tradeTarget = null;
}

function showTradeProposal(fromId, offer) {
  pendingTrade = { fromId, offer };
  const modal = document.getElementById('trade-receive-modal');
  const info = document.getElementById('trade-receive-info');
  const from = window.gameState.players.find(p => p.id === fromId);
  
  let html = `<p><strong>${from ? from.name : 'Pemain'}</strong> menawarkan:</p>`;
  html += '<div class="trade-summary">';
  html += '<div><strong>Mereka berikan:</strong><ul>';
  if (offer.fromMoney > 0) html += `<li>Rp${offer.fromMoney}rb</li>`;
  offer.fromProperties.forEach(id => html += `<li>${boardData[id].name}</li>`);
  html += '</ul></div>';
  html += '<div><strong>Mereka minta:</strong><ul>';
  if (offer.toMoney > 0) html += `<li>Rp${offer.toMoney}rb</li>`;
  offer.toProperties.forEach(id => html += `<li>${boardData[id].name}</li>`);
  html += '</ul></div></div>';
  
  info.innerHTML = html;
  modal.classList.remove('hidden');
}

function respondTrade(accepted) {
  if (!pendingTrade) return;
  socket.emit('trade-respond', { fromId: pendingTrade.fromId, accepted, offer: pendingTrade.offer });
  document.getElementById('trade-receive-modal').classList.add('hidden');
  pendingTrade = null;
}
