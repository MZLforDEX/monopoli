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

test('Mortgaged airports and utilities are excluded from active count in rent calculation', () => {
  const room = new GameRoom('NUS-MTG', 'p1');
  room.addPlayer('p1', 'Raja', 'merah');
  room.addPlayer('p2', 'Tamu', 'biru');
  room.startGame(true);

  // Own 2 airports: Soekarno-Hatta (5) and Ngurah Rai (15)
  room.buyProperty('p1', 5);
  room.buyProperty('p1', 15);
  const p1 = room.players.get('p1');
  assert.equal(rules.calculateRent(properties[5], room.boardState[5], 7, p1.properties, room.boardState), 500);

  // Mortgage Ngurah Rai (15) -> landing on Soekarno-Hatta (5) counts only 1 active airport
  room.mortgageProperty('p1', 15);
  assert.equal(rules.calculateRent(properties[5], room.boardState[5], 7, p1.properties, room.boardState), 250);
  assert.equal(rules.calculateRent(properties[15], room.boardState[15], 7, p1.properties, room.boardState), 0);

  // Own 2 utilities: PLN (12) and PDAM (28)
  room.buyProperty('p1', 12);
  room.buyProperty('p1', 28);
  assert.equal(rules.calculateRent(properties[12], room.boardState[12], 8, p1.properties, room.boardState), 800);

  // Mortgage PDAM (28) -> PLN charges 40x dice instead of 100x
  room.mortgageProperty('p1', 28);
  assert.equal(rules.calculateRent(properties[12], room.boardState[12], 8, p1.properties, room.boardState), 320);
});

test('Bankruptcy via payRent transfers cash, liquidated buildings, Jail-Free cards, and properties to creditor', () => {
  const room = new GameRoom('NUS-BNK', 'p1');
  room.addPlayer('p1', 'Kreditur', 'merah');
  room.addPlayer('p2', 'Debitur', 'biru');
  room.startGame(true);

  const p1 = room.players.get('p1');
  const p2 = room.players.get('p2');

  // Give p1 full brown group with a hotel on 3 (rent = 48 * 125 = 6000)
  room.buyProperty('p1', 1);
  room.buyProperty('p1', 3);
  room.boardState[3].hotel = true;

  // Give p2 Medan (pos 6, houseCost 500 -> 50% refund = 250) + jailFreeCard + small cash
  room.buyProperty('p2', 6);
  room.boardState[6].houses = 1;
  p2.jailFreeCards = 2;
  p2.money = 400;

  const p1MoneyBefore = p1.money;
  const rent = room.payRent('p2', 3, 5);
  assert.equal(rent, 6000);
  assert.equal(p2.bankrupt, true);
  assert.equal(p2.money, 0);
  assert.equal(p2.properties.length, 0);
  assert.equal(p2.jailFreeCards, 0);

  // p1 receives p2's remaining cash (400) + 50% of p2's building (250) = +650, plus pos 6 and 2 jail-free cards
  assert.equal(p1.money, p1MoneyBefore + 650);
  assert.equal(room.boardState[6].ownerId, 'p1');
  assert.equal(room.boardState[6].houses, 0);
  assert.ok(p1.properties.includes(6));
  assert.equal(p1.jailFreeCards, 2);
});

test('Bank building supply caps at 32 houses and 12 hotels, and mortgaged group rules apply properly', () => {
  const room = new GameRoom('NUS-SUP', 'p1');
  room.addPlayer('p1', 'Sultan', 'merah');
  room.addPlayer('p2', 'Lawan', 'biru');
  room.startGame(true);

  // Full brown group: 1 and 3
  room.buyProperty('p1', 1);
  room.buyProperty('p1', 3);
  // Mortgage tile 3 -> cannot build on tile 1, but tile 1 still gets 2x base rent!
  room.mortgageProperty('p1', 3);
  assert.equal(rules.canBuildHouse('p1', 1, room.boardState), false);
  const p1 = room.players.get('p1');
  assert.equal(rules.calculateRent(properties[1], room.boardState[1], 6, p1.properties, room.boardState), 96);

  // Unmortgage tile 3 and fill Bank to 32 houses across other tiles
  p1.money = 50000;
  room.unmortgageProperty('p1', 3);
  const otherProps = [6, 8, 9, 11, 13, 14, 16, 18]; // 8 * 4 = 32 houses
  otherProps.forEach(id => {
    room.boardState[id].ownerId = 'p2';
    room.boardState[id].houses = 4;
  });
  assert.equal(rules.getBuildingSupply(room.boardState).housesRemaining, 0);
  assert.equal(rules.canBuildHouse('p1', 1, room.boardState), false);

  // Free 4 houses and test hotel cap of 12 hotels
  room.boardState[18].houses = 0;
  assert.equal(rules.canBuildHouse('p1', 1, room.boardState), true);

  room.boardState[1].houses = 4;
  room.boardState[3].houses = 4;
  assert.equal(rules.canBuildHotel('p1', 1, room.boardState), true);

  const hotelProps = [6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24]; // 12 hotels
  hotelProps.forEach(id => {
    room.boardState[id].hotel = true;
    room.boardState[id].houses = 0;
  });
  assert.equal(rules.getBuildingSupply(room.boardState).hotelsRemaining, 0);
  assert.equal(rules.canBuildHotel('p1', 1, room.boardState), false);
});

test('Escaping Jail via doubles does not grant a bonus roll, and trading blocks groups with buildings', () => {
  const room = new GameRoom('NUS-JAIL', 'p1');
  room.addPlayer('p1', 'Bebas', 'merah');
  room.addPlayer('p2', 'Partner', 'biru');
  room.startGame(true);

  room.lastDice = { d1: 4, d2: 4, total: 8, isDouble: true };
  room.escapedJailByDouble = true;
  room.startAuction(1);
  room.passAuction('p1');
  room.passAuction('p2');
  // Since escapedJailByDouble is true, endAuction must enter 'end' phase, NOT 'roll'
  assert.equal(room.turnPhase, 'end');

  // Cannot trade a lot from a group that has buildings on any sibling lot
  room.buyProperty('p1', 1);
  room.buyProperty('p1', 3);
  room.buildHouse('p1', 1);
  const blockedTrade = room.executeTrade('p1', 'p2', {
    fromMoney: 0,
    toMoney: 500,
    fromProperties: [3],
    toProperties: []
  });
  assert.equal(blockedTrade, false);
});

test('formatRupiah formats Indonesian currency cleanly (Rp1000, Rp10.000, Rp100.000, Rp 1jt, Rp 1,12jt)', () => {
  assert.equal(rules.formatRupiah(0), 'Rp0');
  assert.equal(rules.formatRupiah(1), 'Rp1000');
  assert.equal(rules.formatRupiah(10), 'Rp10.000');
  assert.equal(rules.formatRupiah(48), 'Rp48.000');
  assert.equal(rules.formatRupiah(100), 'Rp100.000');
  assert.equal(rules.formatRupiah(500), 'Rp500.000');
  assert.equal(rules.formatRupiah(1000), 'Rp 1jt');
  assert.equal(rules.formatRupiah(1120), 'Rp 1,12jt');
  assert.equal(rules.formatRupiah(1500), 'Rp 1,5jt');
  assert.equal(rules.formatRupiah(2000), 'Rp 2jt');
  assert.equal(rules.formatRupiah(15000), 'Rp 15jt');
  assert.equal(rules.formatRupiah(-500), '-Rp500.000');
});

test('vercel.json configures public outputDirectory cleanly', () => {
  const vercelCfg = require('../vercel.json');
  assert.equal(vercelCfg.outputDirectory, 'public');
  assert.equal(vercelCfg.framework, null);
  assert.equal(vercelCfg.buildCommand, 'npm run build');
});

test('Client local-engine runs quick-start, roll-dice, and buy/auction flow offline', async () => {
  const cardsData = require('../public/data/cards.json');
  const { createLocalMonopolySocket } = require('../public/js/local-engine');
  const localSocket = createLocalMonopolySocket({ properties, cards: cardsData });

  let latestState = null;
  let diceEvent = null;
  localSocket.on('room-state', (s) => { latestState = s; });
  localSocket.on('dice-result', (d) => { diceEvent = d; });

  const startRes = await new Promise(resolve => {
    localSocket.emit('quick-start', { name: 'Tester', token: 'merah', botCount: 3 }, resolve);
  });

  assert.equal(startRes.success, true);
  assert.equal(latestState.players.length, 4);
  assert.equal(latestState.currentPlayerId, startRes.playerId);
  assert.equal(latestState.players[0].money, 15000);

  localSocket.emit('roll-dice');
  assert.ok(diceEvent && diceEvent.dice.total >= 2);
  assert.ok(latestState.players[0].position > 0 || latestState.players[0].inJail);
});

test('Multi-player local host engine supports room creation, guest join with pawn auto-assign, and 2-human turns/trade', async () => {
  const cardsData = require('../public/data/cards.json');
  const { createLocalMonopolyEngine } = require('../public/js/local-engine');
  const engine = createLocalMonopolyEngine({ properties, cards: cardsData });

  const events = [];
  engine.onBroadcast((ev, payload) => events.push({ ev, payload }));

  await engine.createLobbyRoom('NUS-P2P', 'host-1', 'Andi', 'merah');
  const joinRes = engine.joinLobbyPlayer('guest-2', 'Budi', 'merah'); // same token 'merah' -> auto-reassigned
  assert.equal(joinRes.success, true);
  assert.equal(joinRes.tokenReassigned, true);
  assert.equal(joinRes.assignedToken, 'biru');

  assert.equal(engine.startLobbyGame(true), true);
  const snap1 = engine.getStateSnapshot();
  assert.equal(snap1.state, 'playing');
  assert.equal(snap1.currentPlayerId, 'host-1');

  // Guest cannot roll out of turn
  engine.handleClientEvent('guest-2', 'roll-dice');
  assert.equal(events.filter(e => e.ev === 'dice-result').length, 0);

  // Host rolls and ends turn -> passes to guest-2 (unless double roll)
  engine.handleClientEvent('host-1', 'roll-dice');
  assert.equal(events.filter(e => e.ev === 'dice-result').length, 1);
  engine.handleClientEvent('host-1', 'end-turn');
  const snap2 = engine.getStateSnapshot();
  assert.equal(snap2.currentPlayerId, 'guest-2');

  // Direct human-to-human trade proposal & accept
  engine.handleClientEvent('host-1', 'trade-offer', {
    toId: 'guest-2',
    offer: { fromMoney: 500, toMoney: 0, fromProperties: [], toProperties: [] }
  });
  const tradeProp = events.find(e => e.ev === 'trade-proposal');
  assert.ok(tradeProp && tradeProp.payload.fromId === 'host-1' && tradeProp.payload.toId === 'guest-2');

  engine.handleClientEvent('guest-2', 'trade-respond', {
    fromId: 'host-1',
    accepted: true,
    offer: tradeProp.payload.offer
  });
  const snap3 = engine.getStateSnapshot();
  const guest = snap3.players.find(p => p.id === 'guest-2');
  assert.equal(guest.money, 15500);
});




