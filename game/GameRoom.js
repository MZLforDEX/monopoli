const Player = require('./Player');
const Bot = require('./Bot');
const rules = require('./rules');
const properties = require('../public/data/properties.json');
const cards = require('../public/data/cards.json');

class GameRoom {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map(); // id -> Player
    this.state = 'lobby'; // 'lobby' | 'playing' | 'finished'
    this.currentPlayerIndex = 0;
    this.turnOrder = []; // player ids
    this.turnPhase = 'roll'; // 'roll' | 'buying' | 'auction' | 'end'
    this.lastDice = null;
    this.boardState = {}; // propertyId -> { ownerId, houses, hotel, mortgaged }
    this.chanceDeck = this.shuffleDeck([...cards.chance]);
    this.communityDeck = this.shuffleDeck([...cards.community]);
    this.chanceIndex = 0;
    this.communityIndex = 0;
    this.turnTimer = null;
    this.auctionState = null;
    this.tradeState = null;
    this.botThinking = false;
    this.logs = [];
    this.winnerId = null;
    this.lastActivity = Date.now();
  }

  addLog(message) {
    const entry = { message, timestamp: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > 60) this.logs.shift();
    return entry;
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  generateBotId() {
    return 'bot-' + Math.random().toString(36).slice(2, 8);
  }

  addPlayer(id, name, token, isBot = false) {
    if (this.players.size >= 4) return null;
    if (this.state !== 'lobby') return null;
    for (const [, p] of this.players) {
      if (p.token === token) return null;
    }
    const cleanName = String(name || 'Pemain').trim().slice(0, 15) || 'Pemain';
    const player = new Player(id, cleanName, token, isBot);
    this.players.set(id, player);
    return player;
  }

  addBot() {
    const botNames = ['Bot Garuda', 'Bot Komodo', 'Bot Rajawali', 'Bot Cendrawasih'];
    const tokens = ['merah', 'biru', 'hijau', 'kuning'];
    const usedTokens = [...this.players.values()].map(p => p.token);
    const availToken = tokens.find(t => !usedTokens.includes(t));
    if (!availToken) return null;
    const usedNames = [...this.players.values()].map(p => p.name);
    const botName = botNames.find(n => !usedNames.includes(n)) || 'Bot ' + (this.players.size + 1);
    const botId = this.generateBotId();
    return this.addPlayer(botId, botName, availToken, true);
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) return 'empty';
    const humanRemaining = [...this.players.values()].some(p => !p.isBot);
    if (!humanRemaining) return 'empty';
    if (id === this.hostId) {
      const nextHuman = [...this.players.values()].find(p => !p.isBot);
      this.hostId = nextHuman ? nextHuman.id : this.players.keys().next().value;
    }
    return 'ok';
  }

  rejoinPlayer(oldId, newId) {
    if (oldId === newId) {
      const p = this.players.get(newId);
      if (p) p.connected = true;
      return p;
    }
    const player = this.players.get(oldId);
    if (!player) return null;

    this.players.delete(oldId);
    player.id = newId;
    player.connected = true;
    this.players.set(newId, player);

    this.turnOrder = this.turnOrder.map(id => (id === oldId ? newId : id));
    if (this.hostId === oldId) this.hostId = newId;
    if (this.winnerId === oldId) this.winnerId = newId;

    for (const [, state] of Object.entries(this.boardState)) {
      if (state.ownerId === oldId) state.ownerId = newId;
    }

    if (this.auctionState) {
      this.auctionState.participants = this.auctionState.participants.map(id => (id === oldId ? newId : id));
      if (this.auctionState.currentBidder === oldId) {
        this.auctionState.currentBidder = newId;
      }
      if (this.auctionState.passed.has(oldId)) {
        this.auctionState.passed.delete(oldId);
        this.auctionState.passed.add(newId);
      }
    }

    return player;
  }

  startGame(keepHostFirst = false) {
    if (this.players.size < 2) return false;
    this.state = 'playing';
    const allIds = [...this.players.keys()];

    if (keepHostFirst) {
      const others = allIds.filter(id => id !== this.hostId);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      this.turnOrder = [this.hostId, ...others];
    } else {
      // Put human players before bots on turn 1 so page redirect never misses turn 1
      const humans = allIds.filter(id => !this.players.get(id).isBot);
      const bots = allIds.filter(id => this.players.get(id).isBot);
      this.shuffleDeck(humans);
      this.shuffleDeck(bots);
      this.turnOrder = [...humans, ...bots];
    }

    this.currentPlayerIndex = 0;
    this.turnPhase = 'roll';
    this.lastDice = null;

    properties.forEach(p => {
      if (['property', 'airport', 'utility'].includes(p.type)) {
        this.boardState[p.id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
      }
    });
    return true;
  }

  getCurrentPlayer() {
    if (this.state !== 'playing') return null;
    return this.players.get(this.turnOrder[this.currentPlayerIndex]) || null;
  }

  checkWinCondition() {
    const activePlayers = this.turnOrder.filter(id => {
      const p = this.players.get(id);
      return p && !p.bankrupt;
    });
    if (activePlayers.length <= 1) {
      this.state = 'finished';
      this.winnerId = activePlayers[0] || null;
      return { type: 'game-over', winner: this.winnerId };
    }
    return null;
  }

  nextTurn() {
    const winCheck = this.checkWinCondition();
    if (winCheck) return winCheck;

    let safety = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.turnOrder.length;
      safety++;
    } while (
      this.players.get(this.turnOrder[this.currentPlayerIndex])?.bankrupt &&
      safety <= this.turnOrder.length
    );

    const current = this.getCurrentPlayer();
    if (current) {
      current.doublesCount = 0;
    }
    this.turnPhase = 'roll';
    this.lastDice = null;
    return { type: 'next-turn', playerId: current ? current.id : null };
  }

  movePlayer(playerId, steps) {
    const player = this.players.get(playerId);
    const oldPos = player.position;
    player.position = (player.position + steps + 40) % 40;
    const passedStart = steps > 0 && player.position < oldPos;
    if (passedStart) {
      player.money += 2000;
    }
    return { fromPosition: oldPos, newPosition: player.position, passedStart };
  }

  movePlayerTo(playerId, position) {
    const player = this.players.get(playerId);
    const oldPos = player.position;
    player.position = position;
    const passedStart = position < oldPos && position !== 10;
    if (passedStart) {
      player.money += 2000;
    }
    return { fromPosition: oldPos, newPosition: player.position, passedStart };
  }

  sendToJail(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
    player.doublesCount = 0;
  }

  bankruptPlayer(playerId, creditorId = null) {
    const player = this.players.get(playerId);
    if (!player) return;
    const creditor = creditorId ? this.players.get(creditorId) : null;

    if (creditor && player.money > 0) {
      creditor.money += player.money;
    }
    player.money = 0;
    player.bankrupt = true;
    player.inJail = false;
    player.jailTurns = 0;
    player.doublesCount = 0;

    player.properties.forEach(id => {
      this.boardState[id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
    });
    player.properties = [];
  }

  buyProperty(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    const state = this.boardState[propertyId];
    if (!player || !space || !state) return false;
    if (!space.price || player.money < space.price) return false;
    if (state.ownerId) return false;

    player.money -= space.price;
    player.properties.push(propertyId);
    state.ownerId = playerId;
    return true;
  }

  payRent(payerId, propertyId, diceTotal) {
    const payer = this.players.get(payerId);
    const state = this.boardState[propertyId];
    if (!payer || !state || !state.ownerId || state.ownerId === payerId || state.mortgaged) return 0;
    const owner = this.players.get(state.ownerId);
    if (!owner || owner.bankrupt) return 0;

    const space = properties[propertyId];
    const rent = rules.calculateRent(space, state, diceTotal, owner.properties, this.boardState);
    if (payer.money < rent) {
      owner.money += Math.max(0, payer.money);
      this.bankruptPlayer(payerId, null);
    } else {
      payer.money -= rent;
      owner.money += rent;
    }
    return rent;
  }

  buildHouse(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    if (!player || !space) return false;
    if (!rules.canBuildHouse(playerId, propertyId, this.boardState)) return false;
    if (player.money < space.houseCost) return false;
    player.money -= space.houseCost;
    this.boardState[propertyId].houses++;
    return true;
  }

  buildHotel(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    if (!player || !space) return false;
    if (!rules.canBuildHotel(playerId, propertyId, this.boardState)) return false;
    if (player.money < space.houseCost) return false;
    player.money -= space.houseCost;
    this.boardState[propertyId].houses = 0;
    this.boardState[propertyId].hotel = true;
    return true;
  }

  sellBuilding(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    const state = this.boardState[propertyId];
    if (!player || !space || !state) return false;
    if (!rules.canSellBuilding(playerId, propertyId, this.boardState)) return false;

    const refund = Math.floor(space.houseCost / 2);
    if (state.hotel) {
      state.hotel = false;
      state.houses = 4;
    } else {
      state.houses--;
    }
    player.money += refund;
    return refund;
  }

  mortgageProperty(playerId, propertyId) {
    const state = this.boardState[propertyId];
    if (!state || state.ownerId !== playerId || state.mortgaged) return false;
    if (state.houses > 0 || state.hotel) return false;
    // Also check no buildings exist in the same color group
    const space = properties[propertyId];
    if (space.group) {
      const groupHasBuildings = properties
        .filter(p => p.group === space.group)
        .some(p => this.boardState[p.id] && (this.boardState[p.id].houses > 0 || this.boardState[p.id].hotel));
      if (groupHasBuildings) return false;
    }
    state.mortgaged = true;
    const player = this.players.get(playerId);
    player.money += rules.getMortgageValue(propertyId);
    return true;
  }

  unmortgageProperty(playerId, propertyId) {
    const state = this.boardState[propertyId];
    if (!state || state.ownerId !== playerId || !state.mortgaged) return false;
    const cost = rules.getUnmortgageCost(propertyId);
    const player = this.players.get(playerId);
    if (player.money < cost) return false;
    player.money -= cost;
    state.mortgaged = false;
    return true;
  }

  drawCard(type) {
    let card;
    if (type === 'chance') {
      card = this.chanceDeck[this.chanceIndex];
      this.chanceIndex = (this.chanceIndex + 1) % this.chanceDeck.length;
    } else {
      card = this.communityDeck[this.communityIndex];
      this.communityIndex = (this.communityIndex + 1) % this.communityDeck.length;
    }
    return card;
  }

  startAuction(propertyId) {
    this.turnPhase = 'auction';
    this.auctionState = {
      propertyId,
      currentBid: 0,
      currentBidder: null,
      participants: this.turnOrder.filter(id => !this.players.get(id)?.bankrupt),
      passed: new Set()
    };
    return this.auctionState;
  }

  placeBid(playerId, amount) {
    if (!this.auctionState) return false;
    const player = this.players.get(playerId);
    if (!player || player.bankrupt) return false;
    if (this.auctionState.passed.has(playerId)) return false;
    if (amount > player.money) return false;
    if (amount <= this.auctionState.currentBid) return false;
    this.auctionState.currentBid = amount;
    this.auctionState.currentBidder = playerId;
    return true;
  }

  isAuctionComplete() {
    if (!this.auctionState) return false;
    const { participants, passed, currentBidder } = this.auctionState;
    const activeOthers = participants.filter(id => !passed.has(id) && id !== currentBidder);
    if (currentBidder !== null && activeOthers.length === 0) return true;
    if (currentBidder === null && passed.size >= participants.length) return true;
    return false;
  }

  passAuction(playerId) {
    if (!this.auctionState) return null;
    this.auctionState.passed.add(playerId);
    if (this.isAuctionComplete()) {
      return this.endAuction();
    }
    return { type: 'auction-pass', playerId };
  }

  endAuction() {
    if (!this.auctionState) {
      return { type: 'auction-end', winner: null };
    }
    const { currentBidder, propertyId, currentBid } = this.auctionState;
    this.auctionState = null;

    const current = this.getCurrentPlayer();
    if (current && !current.bankrupt && !current.inJail && this.lastDice?.isDouble) {
      this.turnPhase = 'roll';
    } else {
      this.turnPhase = 'end';
    }

    if (!currentBidder) {
      return { type: 'auction-end', winner: null, propertyId, amount: 0 };
    }
    const winner = this.players.get(currentBidder);
    if (winner && winner.money >= currentBid) {
      winner.money -= currentBid;
      winner.properties.push(propertyId);
      this.boardState[propertyId].ownerId = currentBidder;
      return { type: 'auction-end', winner: currentBidder, propertyId, amount: currentBid };
    }
    return { type: 'auction-end', winner: null, propertyId, amount: 0 };
  }

  executeTrade(fromId, toId, offer) {
    const from = this.players.get(fromId);
    const to = this.players.get(toId);
    if (!from || !to || from.bankrupt || to.bankrupt) return false;
    const fromMoney = Math.max(0, Number(offer.fromMoney) || 0);
    const toMoney = Math.max(0, Number(offer.toMoney) || 0);
    const fromProperties = Array.isArray(offer.fromProperties) ? offer.fromProperties : [];
    const toProperties = Array.isArray(offer.toProperties) ? offer.toProperties : [];

    if (from.money < fromMoney || to.money < toMoney) return false;
    if (fromMoney === 0 && toMoney === 0 && fromProperties.length === 0 && toProperties.length === 0) return false;

    for (const id of fromProperties) {
      const s = this.boardState[id];
      if (!s || s.ownerId !== fromId || s.houses > 0 || s.hotel) return false;
    }
    for (const id of toProperties) {
      const s = this.boardState[id];
      if (!s || s.ownerId !== toId || s.houses > 0 || s.hotel) return false;
    }

    from.money -= fromMoney;
    to.money += fromMoney;
    to.money -= toMoney;
    from.money += toMoney;

    for (const id of fromProperties) {
      this.boardState[id].ownerId = toId;
      from.properties = from.properties.filter(p => p !== id);
      to.properties.push(id);
    }
    for (const id of toProperties) {
      this.boardState[id].ownerId = fromId;
      to.properties = to.properties.filter(p => p !== id);
      from.properties.push(id);
    }
    return true;
  }

  getState() {
    const playersArr = [];
    for (const [, p] of this.players) {
      playersArr.push(p.toJSON());
    }
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      players: playersArr,
      currentPlayerId: this.getCurrentPlayer()?.id || null,
      turnOrder: this.turnOrder,
      turnPhase: this.turnPhase,
      lastDice: this.lastDice,
      winnerId: this.winnerId,
      boardState: this.boardState,
      auctionState: this.auctionState ? {
        propertyId: this.auctionState.propertyId,
        currentBid: this.auctionState.currentBid,
        currentBidder: this.auctionState.currentBidder,
        participants: this.auctionState.participants,
        passed: [...this.auctionState.passed]
      } : null
    };
  }
}

module.exports = GameRoom;
