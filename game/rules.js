const properties = require('../public/data/properties.json');

function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return { d1, d2, total: d1 + d2, isDouble: d1 === d2 };
}

function ownsFullGroup(playerId, group, boardState, ownerProperties) {
  if (!group) return false;
  const groupProps = properties.filter(p => p.group === group).map(p => p.id);
  if (boardState) {
    return groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged);
  }
  if (Array.isArray(ownerProperties)) {
    return groupProps.every(id => ownerProperties.includes(id));
  }
  return false;
}

function calculateRent(space, propertyState, diceTotal, ownerProperties, boardState = null) {
  if (!propertyState || propertyState.mortgaged) return 0;

  if (space.type === 'airport') {
    const airportCount = (ownerProperties || []).filter(id => properties[id] && properties[id].type === 'airport').length;
    return [0, 250, 500, 1000, 2000][airportCount] || 0;
  }

  if (space.type === 'utility') {
    const utilCount = (ownerProperties || []).filter(id => properties[id] && properties[id].type === 'utility').length;
    return diceTotal * (utilCount >= 2 ? 100 : 40);
  }

  if (space.type !== 'property') return 0;

  // Property with buildings
  const level = propertyState.hotel ? 5 : (propertyState.houses || 0);
  if (level === 0 && ownsFullGroup(propertyState.ownerId, space.group, boardState, ownerProperties)) {
    return space.rent * 2;
  }
  return space.rent * space.rentMultipliers[level];
}

function canBuildHouse(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (!space || space.type !== 'property') return false;

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

module.exports = {
  rollDice,
  ownsFullGroup,
  calculateRent,
  canBuildHouse,
  canBuildHotel,
  canSellBuilding,
  getMortgageValue,
  getUnmortgageCost
};
