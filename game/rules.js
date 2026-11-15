const properties = require('../public/data/properties.json');

function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return { d1, d2, total: d1 + d2, isDouble: d1 === d2 };
}

function ownsFullGroup(playerId, group, boardState, ownerProperties, requireAllUnmortgaged = false) {
  if (!group) return false;
  const groupProps = properties.filter(p => p.group === group).map(p => p.id);
  if (boardState) {
    return groupProps.every(id =>
      boardState[id] &&
      boardState[id].ownerId === playerId &&
      (!requireAllUnmortgaged || !boardState[id].mortgaged)
    );
  }
  if (Array.isArray(ownerProperties)) {
    return groupProps.every(id => ownerProperties.includes(id));
  }
  return false;
}

function getBuildingSupply(boardState) {
  let housesUsed = 0;
  let hotelsUsed = 0;
  if (boardState) {
    for (const state of Object.values(boardState)) {
      if (!state) continue;
      if (state.hotel) hotelsUsed += 1;
      else housesUsed += state.houses || 0;
    }
  }
  return {
    housesRemaining: Math.max(0, 32 - housesUsed),
    hotelsRemaining: Math.max(0, 12 - hotelsUsed)
  };
}

function calculateRent(space, propertyState, diceTotal, ownerProperties, boardState = null) {
  if (!propertyState || propertyState.mortgaged) return 0;

  const isOwnedActive = (id) => {
    if (!boardState || !boardState[id]) return true;
    return boardState[id].ownerId === propertyState.ownerId && !boardState[id].mortgaged;
  };

  if (space.type === 'airport') {
    const airportCount = (ownerProperties || []).filter(id =>
      properties[id] && properties[id].type === 'airport' && isOwnedActive(id)
    ).length;
    return [0, 250, 500, 1000, 2000][airportCount] || 0;
  }

  if (space.type === 'utility') {
    const utilCount = (ownerProperties || []).filter(id =>
      properties[id] && properties[id].type === 'utility' && isOwnedActive(id)
    ).length;
    if (utilCount <= 0) return 0;
    return diceTotal * (utilCount >= 2 ? 100 : 40);
  }

  if (space.type !== 'property') return 0;

  // Property with buildings
  const level = propertyState.hotel ? 5 : (propertyState.houses || 0);
  if (level === 0 && ownsFullGroup(propertyState.ownerId, space.group, boardState, ownerProperties, false)) {
    return space.rent * 2;
  }
  return space.rent * space.rentMultipliers[level];
}

function canBuildHouse(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (!space || space.type !== 'property') return false;

  const supply = getBuildingSupply(boardState);
  if (supply.housesRemaining <= 0) return false;

  const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
  const ownsAll = groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged);
  if (!ownsAll) return false;

  const state = boardState[propertyId];
  if (!state || state.hotel || state.houses >= 4 || state.mortgaged) return false;

  // Even build rule
  const currentHouses = groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses);
  const myHouses = state.houses;
  const minHouses = Math.min(...currentHouses);
  return myHouses <= minHouses;
}

function canBuildHotel(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (!space || space.type !== 'property') return false;

  const supply = getBuildingSupply(boardState);
  if (supply.hotelsRemaining <= 0) return false;

  const state = boardState[propertyId];
  if (!state || state.ownerId !== playerId || state.mortgaged) return false;
  if (state.hotel || state.houses < 4) return false;

  const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
  const ownsAll = groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged);
  if (!ownsAll) return false;

  const currentLevels = groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses);
  const minLevel = Math.min(...currentLevels);
  return minLevel >= 4;
}

function canSellBuilding(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (!space || space.type !== 'property') return false;
  const state = boardState[propertyId];
  if (!state || state.ownerId !== playerId) return false;
  const myLevel = state.hotel ? 5 : state.houses;
  if (myLevel <= 0) return false;

  const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
  const currentLevels = groupProps.map(id => boardState[id] ? (boardState[id].hotel ? 5 : boardState[id].houses) : 0);
  const maxLevel = Math.max(...currentLevels);
  return myLevel >= maxLevel;
}

function getMortgageValue(propertyId) {
  return Math.floor(properties[propertyId].price / 2);
}

function getUnmortgageCost(propertyId) {
  return Math.floor(getMortgageValue(propertyId) * 1.1);
}

function formatRupiah(amountInRibuan) {
  const num = Number(amountInRibuan) || 0;
  const rupiah = Math.round(num * 1000);
  if (rupiah === 0) return 'Rp0';

  const sign = rupiah < 0 ? '-' : '';
  const abs = Math.abs(rupiah);

  if (abs < 10000) {
    return `${sign}Rp${abs}`;
  }
  if (abs < 1000000) {
    return `${sign}Rp${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  }

  const jt = Math.round((abs / 1000000) * 1000) / 1000;
  const [intPart, decPart] = String(jt).split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${sign}Rp ${formattedInt},${decPart}jt` : `${sign}Rp ${formattedInt}jt`;
}

module.exports = {
  rollDice,
  ownsFullGroup,
  getBuildingSupply,
  calculateRent,
  canBuildHouse,
  canBuildHotel,
  canSellBuilding,
  getMortgageValue,
  getUnmortgageCost,
  formatRupiah
};
