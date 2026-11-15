let currentAuction = null;

function showAuctionModal(propertyId, space) {
  currentAuction = { propertyId, space };
  const modal = document.getElementById('auction-modal');
  const info = document.getElementById('auction-info');
  info.innerHTML = `
    <h4 style="color:${space.color || '#fff'}">${space.name}</h4>
    <p>Harga asli: Rp${space.price}rb</p>
  `;
  document.getElementById('current-bid').textContent = 'Rp0';
  document.getElementById('current-bidder').textContent = '-';
  document.getElementById('bid-amount').value = 100;
  modal.classList.remove('hidden');
}

function updateAuctionDisplay(data) {
  document.getElementById('current-bid').textContent = `Rp${data.currentBid}rb`;
  if (data.currentBidder && window.gameState) {
    const bidder = window.gameState.players.find(p => p.id === data.currentBidder);
    document.getElementById('current-bidder').textContent = bidder ? bidder.name : '-';
  }
}

function placeBid() {
  const amount = parseInt(document.getElementById('bid-amount').value);
  if (!amount || amount <= 0) return;
  socket.emit('place-bid', { amount });
}

function passAuction() {
  socket.emit('pass-auction');
  document.getElementById('auction-modal').classList.add('hidden');
}

function closeAuction() {
  document.getElementById('auction-modal').classList.add('hidden');
  currentAuction = null;
}
