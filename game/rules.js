const properties = require('../public/data/properties.json');

function rollDice() {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return { d1, d2, total: d1 + d2, isDouble: d1 === d2 };
}

function calculateRent(space, propertyState, diceTotal, ownerProperties) {
  if (propertyState.mortgaged) return 0;

  if (space.type === 'airport') {
    const airportCount = ownerProperties.filter(id => properties[id].type === 'airport').length;
    return [0, 250, 500, 1000, 2000][airportCount];
  }

  if (space.type === 'utility') {
    const utilCount = ownerProperties.filter(id => properties[id].type === 'utility').length;
    return diceTotal * (utilCount === 1 ? 40 : 100);
  }

  // Property with buildings
  const level = propertyState.hotel ? 5 : propertyState.houses;
  return space.rent * space.rentMultipliers[level];
}

function canBuildHouse(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (space.type !== 'property') return false;

  const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
  const ownsAll = groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId);
  if (!ownsAll) return false;

  const state = boardState[propertyId];
  if (state.hotel) return false;
  if (state.houses >= 4) return false;
  if (state.mortgaged) return false;

  // Even build rule
  const currentHouses = groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses);
  const myHouses = state.houses;
  const minHouses = Math.min(...currentHouses);
  return myHouses <= minHouses;
}

function canBuildHotel(playerId, propertyId, boardState) {
  const space = properties[propertyId];
  if (space.type !== 'property') return false;
  const state = boardState[propertyId];
  if (!state || state.ownerId !== playerId) return false;
  if (state.hotel || state.houses < 4) return false;

  const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
  const ownsAll = groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId);
  return ownsAll;
}

function getMortgageValue(propertyId) {
  return Math.floor(properties[propertyId].price / 2);
}

function getUnmortgageCost(propertyId) {
  return Math.floor(getMortgageValue(propertyId) * 1.1);
}

module.exports = { rollDice, calculateRent, canBuildHouse, canBuildHotel, getMortgageValue, getUnmortgageCost };
