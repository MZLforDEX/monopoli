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
    this.boardState = {}; // propertyId -> { ownerId, houses, hotel, mortgaged }
    this.chanceDeck = this.shuffleDeck([...cards.chance]);
    this.communityDeck = this.shuffleDeck([...cards.community]);
    this.chanceIndex = 0;
    this.communityIndex = 0;
    this.turnTimer = null;
    this.auctionState = null;
    this.tradeState = null;
    this.lastActivity = Date.now();
  }

  shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  generateBotId() {
    return 'bot-' + Math.random().toString(36).substr(2, 6);
  }

  addPlayer(id, name, token, isBot = false) {
    if (this.players.size >= 4) return null;
    if (this.state !== 'lobby') return null;
    // Check token not taken
    for (const [, p] of this.players) {
      if (p.token === token) return null;
    }
    const player = new Player(id, name, token, isBot);
    this.players.set(id, player);
    return player;
  }

  addBot() {
    const botNames = ['Bot Garuda', 'Bot Komodo', 'Bot Rajawali', 'Bot Cendrawasih'];
    const tokens = ['becak', 'pinisi', 'bajaj', 'komodo'];
    const usedTokens = [...this.players.values()].map(p => p.token);
    const availToken = tokens.find(t => !usedTokens.includes(t));
    if (!availToken) return null;
    const usedNames = [...this.players.values()].map(p => p.name);
    const botName = botNames.find(n => !usedNames.includes(n)) || 'Bot ' + this.players.size;
    const botId = this.generateBotId();
    return this.addPlayer(botId, botName, availToken, true);
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.players.size === 0) return 'empty';
    if (id === this.hostId) {
      this.hostId = this.players.keys().next().value;
    }
    return 'ok';
  }

  startGame() {
    if (this.players.size < 2) return false;
    this.state = 'playing';
    this.turnOrder = [...this.players.keys()];
    // Shuffle turn order
    for (let i = this.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
    }
    this.currentPlayerIndex = 0;
    // Init board state for all purchasable properties
    properties.forEach(p => {
      if (['property', 'airport', 'utility'].includes(p.type)) {
        this.boardState[p.id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
      }
    });
    return true;
  }

  getCurrentPlayer() {
    if (this.state !== 'playing') return null;
    return this.players.get(this.turnOrder[this.currentPlayerIndex]);
  }

  nextTurn() {
    const activePlayers = this.turnOrder.filter(id => !this.players.get(id).bankrupt);
    if (activePlayers.length <= 1) {
      this.state = 'finished';
      return { type: 'game-over', winner: activePlayers[0] };
    }
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.turnOrder.length;
    } while (this.players.get(this.turnOrder[this.currentPlayerIndex]).bankrupt);

    const current = this.getCurrentPlayer();
    current.doublesCount = 0;
    return { type: 'next-turn', playerId: current.id };
  }

  movePlayer(playerId, steps) {
    const player = this.players.get(playerId);
    const oldPos = player.position;
    player.position = (player.position + steps) % 40;
    const passedStart = player.position < oldPos && steps > 0;
    if (passedStart) {
      player.money += 2000;
    }
    return { newPosition: player.position, passedStart };
  }

  movePlayerTo(playerId, position) {
    const player = this.players.get(playerId);
    const oldPos = player.position;
    player.position = position;
    // Don't get money going to jail
    const passedStart = position < oldPos && position !== 10;
    if (passedStart) {
      player.money += 2000;
    }
    return { newPosition: player.position, passedStart };
  }

  sendToJail(playerId) {
    const player = this.players.get(playerId);
    player.position = 10;
    player.inJail = true;
    player.jailTurns = 0;
  }

  buyProperty(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    if (!space.price || player.money < space.price) return false;
    if (this.boardState[propertyId].ownerId) return false;
    player.money -= space.price;
    player.properties.push(propertyId);
    this.boardState[propertyId].ownerId = playerId;
    return true;
  }

  payRent(payerId, propertyId, diceTotal) {
    const payer = this.players.get(payerId);
    const state = this.boardState[propertyId];
    if (!state.ownerId || state.ownerId === payerId || state.mortgaged) return 0;
    const owner = this.players.get(state.ownerId);
    const space = properties[propertyId];
    const rent = rules.calculateRent(space, state, diceTotal, owner.properties);
    const paid = Math.min(rent, payer.money);
    payer.money -= paid;
    owner.money += paid;
    if (payer.money <= 0) {
      payer.bankrupt = true;
      // Return all properties to bank
      payer.properties.forEach(id => {
        this.boardState[id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
      });
      payer.properties = [];
    }
    return rent;
  }

  buildHouse(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    if (!rules.canBuildHouse(playerId, propertyId, this.boardState)) return false;
    if (player.money < space.houseCost) return false;
    player.money -= space.houseCost;
    this.boardState[propertyId].houses++;
    return true;
  }

  buildHotel(playerId, propertyId) {
    const player = this.players.get(playerId);
    const space = properties[propertyId];
    if (!rules.canBuildHotel(playerId, propertyId, this.boardState)) return false;
    if (player.money < space.houseCost) return false;
    player.money -= space.houseCost;
    this.boardState[propertyId].houses = 0;
    this.boardState[propertyId].hotel = true;
    return true;
  }

  mortgageProperty(playerId, propertyId) {
    const state = this.boardState[propertyId];
    if (!state || state.ownerId !== playerId || state.mortgaged) return false;
    if (state.houses > 0 || state.hotel) return false;
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
    this.auctionState = {
      propertyId,
      currentBid: 0,
      currentBidder: null,
      participants: this.turnOrder.filter(id => !this.players.get(id).bankrupt),
      passed: new Set()
    };
    return this.auctionState;
  }

  placeBid(playerId, amount) {
    if (!this.auctionState) return false;
    const player = this.players.get(playerId);
    if (amount > player.money) return false;
    if (amount <= this.auctionState.currentBid) return false;
    this.auctionState.currentBid = amount;
    this.auctionState.currentBidder = playerId;
    return true;
  }

  passAuction(playerId) {
    if (!this.auctionState) return null;
    this.auctionState.passed.add(playerId);
    const remaining = this.auctionState.participants.filter(id => !this.auctionState.passed.has(id));
    if (remaining.length <= 1 && this.auctionState.currentBidder) {
      return this.endAuction();
    }
    if (remaining.length === 0) {
      this.auctionState = null;
      return { type: 'auction-end', winner: null };
    }
    return { type: 'auction-pass', playerId };
  }

  endAuction() {
    if (!this.auctionState || !this.auctionState.currentBidder) {
      this.auctionState = null;
      return { type: 'auction-end', winner: null };
    }
    const winnerId = this.auctionState.currentBidder;
    const propertyId = this.auctionState.propertyId;
    const amount = this.auctionState.currentBid;
    const winner = this.players.get(winnerId);
    winner.money -= amount;
    winner.properties.push(propertyId);
    this.boardState[propertyId].ownerId = winnerId;
    this.auctionState = null;
    return { type: 'auction-end', winner: winnerId, propertyId, amount };
  }

  executeTrade(fromId, toId, offer) {
    const from = this.players.get(fromId);
    const to = this.players.get(toId);
    // offer: { fromMoney, toMoney, fromProperties: [ids], toProperties: [ids] }
    if (from.money < offer.fromMoney || to.money < offer.toMoney) return false;

    // Check properties ownership and no buildings
    for (const id of offer.fromProperties) {
      const s = this.boardState[id];
      if (!s || s.ownerId !== fromId || s.houses > 0 || s.hotel) return false;
    }
    for (const id of offer.toProperties) {
      const s = this.boardState[id];
      if (!s || s.ownerId !== toId || s.houses > 0 || s.hotel) return false;
    }

    // Execute
    from.money -= offer.fromMoney;
    to.money += offer.fromMoney;
    to.money -= offer.toMoney;
    from.money += offer.toMoney;

    for (const id of offer.fromProperties) {
      this.boardState[id].ownerId = toId;
      from.properties = from.properties.filter(p => p !== id);
      to.properties.push(id);
    }
    for (const id of offer.toProperties) {
      this.boardState[id].ownerId = fromId;
      to.properties = to.properties.filter(p => p !== id);
      from.properties.push(id);
    }
    return true;
  }

  getState() {
    const playersArr = [];
    for (const [id, p] of this.players) {
      playersArr.push(p.toJSON());
    }
    return {
      code: this.code,
      hostId: this.hostId,
      state: this.state,
      players: playersArr,
      currentPlayerId: this.getCurrentPlayer()?.id || null,
      turnOrder: this.turnOrder,
      boardState: this.boardState,
      auctionState: this.auctionState ? {
        propertyId: this.auctionState.propertyId,
        currentBid: this.auctionState.currentBid,
        currentBidder: this.auctionState.currentBidder,
        passed: [...this.auctionState.passed]
      } : null
    };
  }
}

module.exports = GameRoom;
