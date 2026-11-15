let currentAuction = null;

function showAuctionModal(propertyId, space, auctionState = null) {
  currentAuction = { propertyId, space, currentBid: 0 };
  const modal = document.getElementById('auction-modal');
  const info = document.getElementById('auction-info');
  const meta = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getMeta(space)
    : { title: space.name };
  const artUrl = typeof NusantaraLandmarks !== 'undefined'
    ? NusantaraLandmarks.getDataUrl(space, 640, 260)
    : '';

  info.innerHTML = `
    <div class="auction-prop-banner" style="border-top: 5px solid ${space.color || '#fbbf24'}">
      ${artUrl ? `<img src="${artUrl}" alt="${meta.title}" class="modal-landmark-art">` : ''}
      <div class="modal-prop-header">
        <h4>${space.name}</h4>
        <span class="modal-landmark-sub">📍 ${meta.title}</span>
      </div>
      <p>Harga Pasar: <strong class="mono-num">Rp${space.price.toLocaleString('id-ID')}rb</strong></p>
    </div>
  `;
  document.getElementById('current-bid').textContent = 'Rp0';
  document.getElementById('current-bidder').textContent = 'Belum ada';
  document.getElementById('bid-amount').value = 100;
  modal.classList.remove('hidden');

  if (auctionState) {
    updateAuctionDisplay(auctionState);
  }
}

function updateAuctionDisplay(data) {
  if (!data) return;
  if (currentAuction) {
    currentAuction.currentBid = data.currentBid || 0;
  }
  const bidEl = document.getElementById('current-bid');
  if (bidEl) bidEl.textContent = `Rp${(data.currentBid || 0).toLocaleString('id-ID')}rb`;

  if (data.currentBidder && window.gameState) {
    const bidder = window.gameState.players.find(p => p.id === data.currentBidder);
    document.getElementById('current-bidder').textContent = bidder ? bidder.name : '-';
  } else {
    document.getElementById('current-bidder').textContent = 'Belum ada';
  }

  const nextMinBid = (data.currentBid || 0) + 100;
  const input = document.getElementById('bid-amount');
  if (input && Number(input.value) < nextMinBid) {
    input.value = nextMinBid;
  }
}

function quickBid(increment) {
  const base = currentAuction ? (currentAuction.currentBid || 0) : 0;
  const amount = base + increment;
  const input = document.getElementById('bid-amount');
  if (input) input.value = amount;
  socket.emit('place-bid', { amount });
}

function placeBid() {
  const amount = parseInt(document.getElementById('bid-amount').value, 10);
  if (!amount || amount <= 0) return;
  socket.emit('place-bid', { amount });
}

function passAuction() {
  socket.emit('pass-auction');
}

function closeAuction() {
  document.getElementById('auction-modal').classList.add('hidden');
  currentAuction = null;
}
