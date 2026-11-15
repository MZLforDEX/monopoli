const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('./rules');
const GameRoom = require('./GameRoom');
const Bot = require('./Bot');
const properties = require('../public/data/properties.json');

test('rules.rollDice returns valid 2d6 result', () => {
  for (let i = 0; i < 30; i++) {
    const res = rules.rollDice();
    assert.ok(res.d1 >= 1 && res.d1 <= 6);
    assert.ok(res.d2 >= 1 && res.d2 <= 6);
    assert.equal(res.total, res.d1 + res.d2);
    assert.equal(res.isDouble, res.d1 === res.d2);
  }
});

test('GameRoom turn order, movement, START bonus, and property purchase', () => {
  const room = new GameRoom('NUS-TST', 'p1');
  room.addPlayer('p1', 'Budi', 'becak');
  room.addBot();
  assert.equal(room.players.size, 2);

  const started = room.startGame(true);
  assert.equal(started, true);
  assert.equal(room.state, 'playing');
  assert.equal(room.getCurrentPlayer().id, 'p1');
  assert.equal(room.turnPhase, 'roll');

  // Move p1 to Banda Aceh (pos 1, price 600)
  const move1 = room.movePlayer('p1', 1);
  assert.equal(move1.newPosition, 1);
  assert.equal(move1.passedStart, false);

  const bought = room.buyProperty('p1', 1);
  assert.equal(bought, true);
  assert.equal(room.players.get('p1').money, 15000 - 600);
  assert.equal(room.boardState[1].ownerId, 'p1');

  // Move p1 around the board passing START
  room.players.get('p1').position = 38;
  const movePass = room.movePlayer('p1', 4);
  assert.equal(movePass.newPosition, 2);
  assert.equal(movePass.passedStart, true);
  assert.equal(room.players.get('p1').money, 15000 - 600 + 2000);
});

test('Rent calculation, full group double rent, and even house/hotel building & selling', () => {
  const room = new GameRoom('NUS-BLD', 'p1');
  room.addPlayer('p1', 'Siti', 'pinisi');
  room.addPlayer('p2', 'Andi', 'komodo');
  room.startGame(true);

  // Brown group is Banda Aceh (1) and Sabang (3)
  room.buyProperty('p1', 1);
  // Single property rent (base 48)
  const singleRent = rules.calculateRent(properties[1], room.boardState[1], 7, room.players.get('p1').properties, room.boardState);
  assert.equal(singleRent, 48);

  // Cannot build house before owning full group
  assert.equal(rules.canBuildHouse('p1', 1, room.boardState), false);

  // Own full brown group
  room.buyProperty('p1', 3);
  const fullGroupRent = rules.calculateRent(properties[1], room.boardState[1], 7, room.players.get('p1').properties, room.boardState);
  assert.equal(fullGroupRent, 96); // 2x base rent when owning full group with 0 houses

  // Even building rule: build on 1, then cannot build 2nd house on 1 until 3 has 1 house
  assert.equal(room.buildHouse('p1', 1), true);
  assert.equal(room.boardState[1].houses, 1);
  assert.equal(rules.canBuildHouse('p1', 1, room.boardState), false);
  assert.equal(rules.canBuildHouse('p1', 3, room.boardState), true);

  // Sell building returns 50% of houseCost
  const moneyBeforeSell = room.players.get('p1').money;
  const refund = room.sellBuilding('p1', 1);
  assert.equal(refund, 150);
  assert.equal(room.boardState[1].houses, 0);
  assert.equal(room.players.get('p1').money, moneyBeforeSell + 150);
});

test('Auction lifecycle does not prematurely close in 2-player human+bot game', () => {
  const room = new GameRoom('NUS-AUC', 'human1');
  room.addPlayer('human1', 'Rina', 'becak');
  const bot = room.addBot();
  room.startGame(true);

  room.startAuction(1); // Banda Aceh, price 600
  assert.equal(room.turnPhase, 'auction');
  assert.equal(room.isAuctionComplete(), false);

  // Suppose bot passes immediately before human bids
  const passRes = room.passAuction(bot.id);
  assert.equal(passRes.type, 'auction-pass');
  assert.equal(room.isAuctionComplete(), false); // Human still hasn't bid or passed!

  // Now human places a bid of 100
  const bidOk = room.placeBid('human1', 100);
  assert.equal(bidOk, true);
  // Since bot already passed and human is highest bidder, auction is now complete!
  assert.equal(room.isAuctionComplete(), true);

  const endRes = room.endAuction();
  assert.equal(endRes.winner, 'human1');
  assert.equal(endRes.amount, 100);
  assert.equal(room.boardState[1].ownerId, 'human1');
  assert.equal(room.turnPhase, 'end');
});

test('Rejoin updates player socket ID across room state, board ownership, and auction', () => {
  const room = new GameRoom('NUS-REJ', 'old-sock');
  room.addPlayer('old-sock', 'Dewi', 'bajaj');
  room.addBot();
  room.startGame(true);
  room.buyProperty('old-sock', 6); // Medan

  room.rejoinPlayer('old-sock', 'new-sock');
  assert.equal(room.hostId, 'new-sock');
  assert.equal(room.getCurrentPlayer().id, 'new-sock');
  assert.equal(room.boardState[6].ownerId, 'new-sock');
});
