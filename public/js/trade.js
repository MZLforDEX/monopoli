let tradeTarget = null;
let pendingTrade = null;

function openTradeWith(playerId) {
  if (!window.gameState) return;
  tradeTarget = playerId;
  const modal = document.getElementById('trade-modal');
  const target = window.gameState.players.find(p => p.id === playerId);
  const me = window.gameState.players.find(p => p.id === window.myPlayerId);
  if (!target || !me) return;

  const titleEl = document.getElementById('trade-target-name');
  if (titleEl) titleEl.textContent = target.name;

  const myPropsEl = document.getElementById('trade-my-props');
  myPropsEl.innerHTML = '';
  const myTradable = me.properties.filter(id => {
    const s = window.gameState.boardState[id];
    return s && !s.houses && !s.hotel;
  });

  if (myTradable.length === 0) {
    myPropsEl.innerHTML = '<p class="hint">Tidak ada properti tanpa bangunan</p>';
  } else {
    myTradable.forEach(id => {
      const tile = boardData[id];
      const div = document.createElement('label');
      div.className = 'trade-prop-item';
      div.innerHTML = `
        <input type="checkbox" value="${id}">
        <span class="prop-color" style="background:${tile.color || '#38bdf8'}"></span>
        <span>${tile.name} (${formatRupiah(tile.price)})</span>
      `;
      myPropsEl.appendChild(div);
    });
  }

  const theirPropsEl = document.getElementById('trade-their-props');
  theirPropsEl.innerHTML = '';
  const theirTradable = target.properties.filter(id => {
    const s = window.gameState.boardState[id];
    return s && !s.houses && !s.hotel;
  });

  if (theirTradable.length === 0) {
    theirPropsEl.innerHTML = '<p class="hint">Pemain ini belum memiliki properti</p>';
  } else {
    theirTradable.forEach(id => {
      const tile = boardData[id];
      const div = document.createElement('label');
      div.className = 'trade-prop-item';
      div.innerHTML = `
        <input type="checkbox" value="${id}">
        <span class="prop-color" style="background:${tile.color || '#38bdf8'}"></span>
        <span>${tile.name} (${formatRupiah(tile.price)})</span>
      `;
      theirPropsEl.appendChild(div);
    });
  }

  document.getElementById('trade-my-money').value = 0;
  document.getElementById('trade-their-money').value = 0;
  modal.classList.remove('hidden');
}

function sendTrade() {
  const myProps = [...document.querySelectorAll('#trade-my-props input:checked')].map(el => parseInt(el.value, 10));
  const theirProps = [...document.querySelectorAll('#trade-their-props input:checked')].map(el => parseInt(el.value, 10));
  const myMoney = Math.round((parseInt(document.getElementById('trade-my-money').value, 10) || 0) / 1000);
  const theirMoney = Math.round((parseInt(document.getElementById('trade-their-money').value, 10) || 0) / 1000);

  if (myProps.length === 0 && theirProps.length === 0 && myMoney === 0 && theirMoney === 0) {
    if (typeof showToast === 'function') showToast('Pilih minimal 1 properti atau nominal uang!', 'error');
    return;
  }

  const offer = {
    fromMoney: myMoney,
    toMoney: theirMoney,
    fromProperties: myProps,
    toProperties: theirProps
  };

  socket.emit('trade-offer', { toId: tradeTarget, offer });
  if (typeof showToast === 'function') showToast('Tawaran trade dikirim!', 'info');
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

  let html = `<p><strong>${from ? from.name : 'Pemain'}</strong> mengajukan penawaran:</p>`;
  html += '<div class="trade-summary">';
  html += '<div><strong>Mereka Berikan:</strong><ul>';
  if (offer.fromMoney > 0) html += `<li class="mono-num">💰 ${formatRupiah(offer.fromMoney)}</li>`;
  offer.fromProperties.forEach(id => html += `<li>🏠 ${boardData[id]?.name || id}</li>`);
  if (offer.fromMoney === 0 && offer.fromProperties.length === 0) html += '<li>Tidak ada</li>';
  html += '</ul></div>';
  html += '<div><strong>Mereka Minta:</strong><ul>';
  if (offer.toMoney > 0) html += `<li class="mono-num">💰 ${formatRupiah(offer.toMoney)}</li>`;
  offer.toProperties.forEach(id => html += `<li>🏠 ${boardData[id]?.name || id}</li>`);
  if (offer.toMoney === 0 && offer.toProperties.length === 0) html += '<li>Tidak ada</li>';
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
