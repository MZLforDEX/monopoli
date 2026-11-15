(function (root) {
  function createLocalMonopolyEngine(options = {}) {
    let properties = options.properties || null;
    let cards = options.cards || null;
    let room = null;
    const broadcastHandlers = [];
    const directHandlers = [];

    function emitBroadcast(event, payload) {
      broadcastHandlers.forEach(fn => {
        try {
          fn(event, payload);
        } catch (err) {
          console.error('[LocalEngine broadcast error]', event, err);
        }
      });
    }

    function emitDirect(targetId, event, payload) {
      if (directHandlers.length === 0) {
        emitBroadcast(event, payload);
        return;
      }
      directHandlers.forEach(fn => {
        try {
          fn(targetId, event, payload);
        } catch (err) {
          console.error('[LocalEngine direct error]', targetId, event, err);
        }
      });
    }

    async function ensureDataLoaded() {
      if (!properties) {
        if (typeof window !== 'undefined' && Array.isArray(window.boardData) && window.boardData.length === 40) {
          properties = window.boardData;
        } else if (typeof fetch === 'function') {
          const res = await fetch('/data/properties.json');
          properties = await res.json();
        }
      }
      if (!cards && typeof fetch === 'function') {
        const res = await fetch('/data/cards.json');
        cards = await res.json();
      }
      if (!properties || !cards) {
        throw new Error('Data permainan belum tersedia');
      }
    }

    function formatRp(amountInRibuan) {
      if (typeof root.formatRupiah === 'function') {
        return root.formatRupiah(amountInRibuan);
      }
      const num = Number(amountInRibuan) || 0;
      const rupiah = Math.round(num * 1000);
      if (rupiah === 0) return 'Rp0';
      const sign = rupiah < 0 ? '-' : '';
      const abs = Math.abs(rupiah);
      if (abs < 10000) return `${sign}Rp${abs}`;
      if (abs < 1000000) return `${sign}Rp${String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
      const jt = Math.round((abs / 1000000) * 1000) / 1000;
      const [intPart, decPart] = String(jt).split('.');
      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return decPart ? `${sign}Rp ${formattedInt},${decPart}jt` : `${sign}Rp ${formattedInt}jt`;
    }

    function shuffleDeck(deck) {
      const copy = [...deck];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    function rollDice() {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      return { d1, d2, total: d1 + d2, isDouble: d1 === d2 };
    }

    function getBuildingSupply(boardState) {
      let housesUsed = 0;
      let hotelsUsed = 0;
      Object.values(boardState || {}).forEach(s => {
        if (!s) return;
        if (s.hotel) hotelsUsed += 1;
        else housesUsed += s.houses || 0;
      });
      return {
        housesRemaining: Math.max(0, 32 - housesUsed),
        hotelsRemaining: Math.max(0, 12 - hotelsUsed)
      };
    }

    function ownsFullGroup(playerId, group, boardState, requireAllUnmortgaged = false) {
      if (!group) return false;
      const groupProps = properties.filter(p => p.group === group).map(p => p.id);
      return groupProps.every(id =>
        boardState[id] &&
        boardState[id].ownerId === playerId &&
        (!requireAllUnmortgaged || !boardState[id].mortgaged)
      );
    }

    function calculateRent(space, propertyState, diceTotal, ownerProperties, boardState) {
      if (!propertyState || propertyState.mortgaged) return 0;
      const isOwnedActive = (id) => boardState[id] && boardState[id].ownerId === propertyState.ownerId && !boardState[id].mortgaged;

      if (space.type === 'airport') {
        const count = (ownerProperties || []).filter(id => properties[id] && properties[id].type === 'airport' && isOwnedActive(id)).length;
        return [0, 250, 500, 1000, 2000][count] || 0;
      }
      if (space.type === 'utility') {
        const count = (ownerProperties || []).filter(id => properties[id] && properties[id].type === 'utility' && isOwnedActive(id)).length;
        if (count <= 0) return 0;
        return diceTotal * (count >= 2 ? 100 : 40);
      }
      if (space.type !== 'property') return 0;

      const level = propertyState.hotel ? 5 : (propertyState.houses || 0);
      if (level === 0 && ownsFullGroup(propertyState.ownerId, space.group, boardState, false)) {
        return space.rent * 2;
      }
      return space.rent * space.rentMultipliers[level];
    }

    function canBuildHouse(playerId, propertyId, boardState) {
      const space = properties[propertyId];
      if (!space || space.type !== 'property') return false;
      if (getBuildingSupply(boardState).housesRemaining <= 0) return false;
      const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
      if (!groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged)) return false;
      const state = boardState[propertyId];
      if (!state || state.hotel || state.houses >= 4 || state.mortgaged) return false;
      const minHouses = Math.min(...groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses));
      return state.houses <= minHouses;
    }

    function canBuildHotel(playerId, propertyId, boardState) {
      const space = properties[propertyId];
      if (!space || space.type !== 'property') return false;
      if (getBuildingSupply(boardState).hotelsRemaining <= 0) return false;
      const state = boardState[propertyId];
      if (!state || state.ownerId !== playerId || state.mortgaged || state.hotel || state.houses < 4) return false;
      const groupProps = properties.filter(p => p.group === space.group).map(p => p.id);
      if (!groupProps.every(id => boardState[id] && boardState[id].ownerId === playerId && !boardState[id].mortgaged)) return false;
      const minLevel = Math.min(...groupProps.map(id => boardState[id].hotel ? 5 : boardState[id].houses));
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
      const maxLevel = Math.max(...groupProps.map(id => boardState[id] ? (boardState[id].hotel ? 5 : boardState[id].houses) : 0));
      return myLevel >= maxLevel;
    }

    function botDecide(player, action, ctx) {
      switch (action) {
        case 'buy-property':
          if (player.money < ctx.price) return false;
          return player.money - ctx.price >= 3500;
        case 'auction-bid': {
          const maxAffordable = Math.max(0, player.money - 1500);
          const maxBid = Math.min(Math.floor(ctx.price * 0.8), maxAffordable);
          const nextBid = ctx.currentBid + 100;
          if (nextBid > maxBid || nextBid > player.money) return { bid: false };
          return { bid: true, amount: nextBid };
        }
        case 'jail':
          if (player.jailFreeCards > 0) return 'card';
          return player.money >= 2500 ? 'pay' : 'roll';
        case 'build':
          return player.money >= ctx.houseCost + 3000;
        default:
          return false;
      }
    }

    function createPlayer(id, name, token, isBot) {
      return {
        id,
        name: String(name || 'Pemain').trim().slice(0, 15) || 'Pemain',
        token,
        isBot: Boolean(isBot),
        money: 15000,
        position: 0,
        properties: [],
        inJail: false,
        jailTurns: 0,
        jailFreeCards: 0,
        doublesCount: 0,
        bankrupt: false,
        connected: true
      };
    }

    function initEmptyBoardState() {
      const boardState = {};
      properties.forEach(p => {
        if (['property', 'airport', 'utility'].includes(p.type)) {
          boardState[p.id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
        }
      });
      return boardState;
    }

    function getStateSnapshot() {
      if (!room) return null;
      return {
        code: room.code,
        hostId: room.hostId,
        state: room.state,
        players: [...room.players.values()].map(p => ({ ...p, properties: [...p.properties] })),
        currentPlayerId: room.state === 'playing' ? (room.turnOrder[room.currentPlayerIndex] || null) : null,
        turnOrder: [...room.turnOrder],
        turnPhase: room.turnPhase,
        lastDice: room.lastDice,
        winnerId: room.winnerId,
        boardState: JSON.parse(JSON.stringify(room.boardState)),
        auctionState: room.auctionState ? {
          propertyId: room.auctionState.propertyId,
          currentBid: room.auctionState.currentBid,
          currentBidder: room.auctionState.currentBidder,
          participants: [...room.auctionState.participants],
          passed: [...room.auctionState.passed]
        } : null
      };
    }

    function broadcastRoomState() {
      if (room) emitBroadcast('room-state', getStateSnapshot());
    }

    function broadcastLog(message) {
      const entry = { message, timestamp: Date.now() };
      if (room) {
        room.logs.push(entry);
        if (room.logs.length > 60) room.logs.shift();
      }
      emitBroadcast('game-log', entry);
    }

    async function createLobbyRoom(code, hostId, hostName, hostToken) {
      await ensureDataLoaded();
      const players = new Map();
      const hostPlayer = createPlayer(hostId, hostName || 'Nakhoda', hostToken || 'merah', false);
      players.set(hostId, hostPlayer);

      room = {
        code,
        hostId,
        players,
        state: 'lobby',
        currentPlayerIndex: 0,
        turnOrder: [],
        turnPhase: 'roll',
        lastDice: null,
        escapedJailByDouble: false,
        boardState: initEmptyBoardState(),
        chanceDeck: shuffleDeck(cards.chance),
        communityDeck: shuffleDeck(cards.community),
        chanceIndex: 0,
        communityIndex: 0,
        auctionState: null,
        botThinking: false,
        logs: [],
        winnerId: null
      };
      broadcastLog(`🏝️ Room ${code} dibuat oleh ${hostPlayer.name}`);
      broadcastRoomState();
      return room;
    }

    function joinLobbyPlayer(playerId, name, preferredToken) {
      if (!room) return { success: false, error: 'Room tidak ditemukan' };
      if (room.state !== 'lobby') return { success: false, error: 'Permainan sudah dimulai' };
      if (room.players.size >= 4) return { success: false, error: 'Room sudah penuh (maks 4 pemain)' };

      const usedTokens = [...room.players.values()].map(p => p.token);
      const pref = preferredToken || 'merah';
      const availableToken = !usedTokens.includes(pref)
        ? pref
        : ['merah', 'biru', 'hijau', 'kuning'].find(t => !usedTokens.includes(t));

      if (!availableToken) return { success: false, error: 'Room sudah penuh (maks 4 pemain)' };

      const player = createPlayer(playerId, name, availableToken, false);
      room.players.set(playerId, player);
      broadcastLog(`👋 ${player.name} bergabung ke room!`);
      broadcastRoomState();

      return {
        success: true,
        code: room.code,
        playerId,
        assignedToken: availableToken,
        tokenReassigned: availableToken !== pref
      };
    }

    function addBotToLobby() {
      if (!room || room.state !== 'lobby' || room.players.size >= 4) return null;
      const botNames = ['Bot Garuda', 'Bot Komodo', 'Bot Rajawali', 'Bot Cendrawasih'];
      const tokens = ['merah', 'biru', 'hijau', 'kuning'];
      const usedTokens = [...room.players.values()].map(p => p.token);
      const availToken = tokens.find(t => !usedTokens.includes(t));
      if (!availToken) return null;
      const usedNames = [...room.players.values()].map(p => p.name);
      const botName = botNames.find(n => !usedNames.includes(n)) || `Bot ${room.players.size + 1}`;
      const bot = createPlayer(`bot-${Math.random().toString(36).slice(2, 8)}`, botName, availToken, true);
      room.players.set(bot.id, bot);
      broadcastLog(`🤖 ${botName} ditambahkan ke room`);
      broadcastRoomState();
      return bot;
    }

    function removePlayer(playerId) {
      if (!room) return;
      const p = room.players.get(playerId);
      if (!p) return;
      if (room.state === 'lobby') {
        room.players.delete(playerId);
        broadcastLog(`👋 ${p.name} keluar dari lobby`);
        broadcastRoomState();
      } else {
        p.connected = false;
        broadcastLog(`⚠️ Koneksi ${p.name} terputus`);
        broadcastRoomState();
      }
    }

    function startLobbyGame(keepHostFirst = false) {
      if (!room || room.players.size < 2 || room.state !== 'lobby') return false;
      room.state = 'playing';
      const allIds = [...room.players.keys()];
      if (keepHostFirst) {
        const others = shuffleDeck(allIds.filter(id => id !== room.hostId));
        room.turnOrder = [room.hostId, ...others];
      } else {
        const humans = shuffleDeck(allIds.filter(id => !room.players.get(id).isBot));
        const bots = shuffleDeck(allIds.filter(id => room.players.get(id).isBot));
        room.turnOrder = [...humans, ...bots];
      }
      room.currentPlayerIndex = 0;
      room.turnPhase = 'roll';
      room.lastDice = null;
      room.boardState = initEmptyBoardState();
      broadcastLog('🎮 Permainan dimulai! Selamat menjelajahi Nusantara!');
      broadcastRoomState();
      setTimeout(() => processBotTurn(), 1200);
      return true;
    }

    async function startQuickGame(playerId, name, token, botCount = 3) {
      await ensureDataLoaded();
      const players = new Map();
      const human = createPlayer(playerId, name || 'Nakhoda', token || 'merah', false);
      players.set(human.id, human);

      const botNames = ['Bot Garuda', 'Bot Komodo', 'Bot Rajawali', 'Bot Cendrawasih'];
      const tokens = ['merah', 'biru', 'hijau', 'kuning'];
      const numBots = Math.min(3, Math.max(1, Number(botCount) || 3));
      for (let i = 0; i < numBots; i++) {
        const usedTokens = [...players.values()].map(p => p.token);
        const availToken = tokens.find(t => !usedTokens.includes(t));
        if (!availToken) break;
        const usedNames = [...players.values()].map(p => p.name);
        const botName = botNames.find(n => !usedNames.includes(n)) || `Bot ${players.size + 1}`;
        const bot = createPlayer(`bot-local-${i + 1}`, botName, availToken, true);
        players.set(bot.id, bot);
      }

      const allIds = [...players.keys()];
      const others = shuffleDeck(allIds.filter(id => id !== human.id));
      room = {
        code: 'LOCAL-1',
        hostId: human.id,
        players,
        state: 'playing',
        currentPlayerIndex: 0,
        turnOrder: [human.id, ...others],
        turnPhase: 'roll',
        lastDice: null,
        escapedJailByDouble: false,
        boardState: initEmptyBoardState(),
        chanceDeck: shuffleDeck(cards.chance),
        communityDeck: shuffleDeck(cards.community),
        chanceIndex: 0,
        communityIndex: 0,
        auctionState: null,
        botThinking: false,
        logs: [],
        winnerId: null
      };
      const entry = { message: `🎮 Mode Lokal dimulai! Kamu melawan ${room.players.size - 1} Bot AI.`, timestamp: Date.now() };
      room.logs.push(entry);
      return { success: true, code: room.code, playerId: human.id, logs: room.logs };
    }

    function getCurrentPlayer() {
      if (!room || room.state !== 'playing') return null;
      return room.players.get(room.turnOrder[room.currentPlayerIndex]) || null;
    }

    function checkWinCondition() {
      if (!room) return null;
      const active = room.turnOrder.filter(id => {
        const p = room.players.get(id);
        return p && !p.bankrupt;
      });
      if (active.length <= 1) {
        room.state = 'finished';
        room.winnerId = active[0] || null;
        return { type: 'game-over', winner: room.winnerId };
      }
      return null;
    }

    function checkAndBroadcastGameOver() {
      const win = checkWinCondition();
      if (win) {
        broadcastRoomState();
        emitBroadcast('game-over', { winnerId: win.winner });
        return true;
      }
      return false;
    }

    function movePlayer(player, steps) {
      const oldPos = player.position;
      player.position = (player.position + steps + 40) % 40;
      const passedStart = steps > 0 && player.position < oldPos;
      if (passedStart) player.money += 2000;
      return { fromPosition: oldPos, newPosition: player.position, passedStart };
    }

    function movePlayerTo(player, position) {
      const oldPos = player.position;
      player.position = position;
      const passedStart = position < oldPos && position !== 10;
      if (passedStart) player.money += 2000;
      return { fromPosition: oldPos, newPosition: player.position, passedStart };
    }

    function sendToJail(player) {
      player.position = 10;
      player.inJail = true;
      player.jailTurns = 0;
      player.doublesCount = 0;
    }

    function bankruptPlayer(playerId, creditorId = null) {
      const player = room.players.get(playerId);
      if (!player) return;
      const creditor = creditorId ? room.players.get(creditorId) : null;

      let buildingRefund = 0;
      player.properties.forEach(id => {
        const s = room.boardState[id];
        const space = properties[id];
        if (!s || !space || !space.houseCost) return;
        const units = s.hotel ? 5 : (s.houses || 0);
        buildingRefund += units * Math.floor(space.houseCost / 2);
        s.houses = 0;
        s.hotel = false;
      });

      if (creditor && !creditor.bankrupt) {
        const cashTransfer = Math.max(0, player.money) + buildingRefund;
        if (cashTransfer > 0) creditor.money += cashTransfer;
        if (player.jailFreeCards > 0) creditor.jailFreeCards += player.jailFreeCards;
        player.properties.forEach(id => {
          if (room.boardState[id]) room.boardState[id].ownerId = creditor.id;
          if (!creditor.properties.includes(id)) creditor.properties.push(id);
        });
      } else {
        player.properties.forEach(id => {
          room.boardState[id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
        });
      }

      player.money = 0;
      player.jailFreeCards = 0;
      player.bankrupt = true;
      player.inJail = false;
      player.jailTurns = 0;
      player.doublesCount = 0;
      player.properties = [];
    }

    function buyProperty(playerId, propertyId) {
      const player = room.players.get(playerId);
      const space = properties[propertyId];
      const state = room.boardState[propertyId];
      if (!player || !space || !state || !space.price) return false;
      if (player.money < space.price || state.ownerId) return false;
      player.money -= space.price;
      player.properties.push(propertyId);
      state.ownerId = playerId;
      return true;
    }

    function payRent(payerId, propertyId, diceTotal) {
      const payer = room.players.get(payerId);
      const state = room.boardState[propertyId];
      if (!payer || !state || !state.ownerId || state.ownerId === payerId || state.mortgaged) return 0;
      const owner = room.players.get(state.ownerId);
      if (!owner || owner.bankrupt) return 0;
      const rent = calculateRent(properties[propertyId], state, diceTotal, owner.properties, room.boardState);
      if (payer.money < rent) {
        bankruptPlayer(payerId, owner.id);
      } else {
        payer.money -= rent;
        owner.money += rent;
      }
      return rent;
    }

    function updateTurnPhaseAfterResolution(player) {
      if (!room || !player) return;
      if (player.bankrupt || player.inJail) {
        room.turnPhase = 'end';
      } else if (room.lastDice && room.lastDice.isDouble && !room.escapedJailByDouble) {
        room.turnPhase = 'roll';
      } else {
        room.turnPhase = 'end';
      }
    }

    function startAuction(propertyId) {
      room.turnPhase = 'auction';
      room.auctionState = {
        propertyId,
        currentBid: 0,
        currentBidder: null,
        participants: room.turnOrder.filter(id => !room.players.get(id)?.bankrupt),
        passed: new Set()
      };
      return room.auctionState;
    }

    function isAuctionComplete() {
      if (!room.auctionState) return false;
      const { participants, passed, currentBidder } = room.auctionState;
      const activeOthers = participants.filter(id => !passed.has(id) && id !== currentBidder);
      if (currentBidder !== null && activeOthers.length === 0) return true;
      if (currentBidder === null && passed.size >= participants.length) return true;
      return false;
    }

    function endAuction() {
      if (!room.auctionState) return { type: 'auction-end', winner: null };
      const { currentBidder, propertyId, currentBid } = room.auctionState;
      room.auctionState = null;
      const current = getCurrentPlayer();
      if (current && !current.bankrupt && !current.inJail && room.lastDice?.isDouble && !room.escapedJailByDouble) {
        room.turnPhase = 'roll';
      } else {
        room.turnPhase = 'end';
      }
      if (!currentBidder) {
        return { type: 'auction-end', winner: null, propertyId, amount: 0 };
      }
      const winner = room.players.get(currentBidder);
      if (winner && winner.money >= currentBid) {
        winner.money -= currentBid;
        winner.properties.push(propertyId);
        room.boardState[propertyId].ownerId = currentBidder;
        return { type: 'auction-end', winner: currentBidder, propertyId, amount: currentBid };
      }
      return { type: 'auction-end', winner: null, propertyId, amount: 0 };
    }

    function placeBid(playerId, amount) {
      if (!room.auctionState) return false;
      const player = room.players.get(playerId);
      if (!player || player.bankrupt || room.auctionState.passed.has(playerId)) return false;
      if (amount > player.money || amount <= room.auctionState.currentBid) return false;
      room.auctionState.currentBid = amount;
      room.auctionState.currentBidder = playerId;
      return true;
    }

    function emitAuctionEnd(result) {
      emitBroadcast('auction-end', result);
      if (result.winner) {
        const winner = room.players.get(result.winner);
        const propName = properties[result.propertyId]?.name || 'Properti';
        broadcastLog(`🏆 ${winner ? winner.name : 'Pemain'} memenangkan lelang ${propName} seharga ${formatRp(result.amount)}!`);
      } else {
        broadcastLog('🔨 Lelang berakhir tanpa pemenang.');
      }
      broadcastRoomState();

      const current = getCurrentPlayer();
      if (room.state === 'playing' && current && current.isBot) {
        tryBotBuildBuildings(current);
        broadcastRoomState();
        if (checkAndBroadcastGameOver()) return;
        if (room.turnPhase === 'roll') {
          setTimeout(() => processBotTurn(), 900);
        } else {
          setTimeout(() => advanceToNextTurn(), 700);
        }
      }
    }

    function handleBotAuction() {
      if (!room || !room.auctionState) return;
      const auction = room.auctionState;
      const space = properties[auction.propertyId];

      for (const botId of auction.participants) {
        if (!room.auctionState) break;
        const bot = room.players.get(botId);
        if (!bot || !bot.isBot || auction.passed.has(botId) || auction.currentBidder === botId) continue;

        const decision = botDecide(bot, 'auction-bid', { price: space.price, currentBid: auction.currentBid });
        if (decision.bid && placeBid(botId, decision.amount)) {
          broadcastLog(`🤖 ${bot.name} menawar ${formatRp(decision.amount)}`);
        } else {
          auction.passed.add(botId);
          broadcastLog(`🤖 ${bot.name} pass lelang`);
          if (isAuctionComplete()) {
            emitAuctionEnd(endAuction());
            return;
          }
        }
      }

      if (!room.auctionState) return;
      if (isAuctionComplete()) {
        emitAuctionEnd(endAuction());
        return;
      }

      const activeHumans = auction.participants.filter(id => {
        const p = room.players.get(id);
        return p && !p.isBot && !auction.passed.has(id);
      });

      emitBroadcast('auction-update', getStateSnapshot().auctionState);
      broadcastRoomState();
      if (activeHumans.length === 0) {
        setTimeout(() => handleBotAuction(), 500);
      }
    }

    function drawCard(type) {
      if (type === 'chance') {
        const card = room.chanceDeck[room.chanceIndex];
        room.chanceIndex = (room.chanceIndex + 1) % room.chanceDeck.length;
        return card;
      }
      const card = room.communityDeck[room.communityIndex];
      room.communityIndex = (room.communityIndex + 1) % room.communityDeck.length;
      return card;
    }

    function executeCard(playerId, card, diceTotal) {
      const player = room.players.get(playerId);
      if (!player) return;

      switch (card.action) {
        case 'move': {
          const moveRes = movePlayerTo(player, card.value);
          if (moveRes.passedStart) broadcastLog(`${player.name} melewati START, terima ${formatRp(2000)}`);
          handleLanding(playerId, diceTotal);
          break;
        }
        case 'move-back':
          player.position = (player.position - card.value + 40) % 40;
          handleLanding(playerId, diceTotal);
          break;
        case 'move-nearest': {
          let pos = player.position;
          do { pos = (pos + 1) % 40; } while (properties[pos].type !== card.value);
          const moveRes = movePlayerTo(player, pos);
          if (moveRes.passedStart) broadcastLog(`${player.name} melewati START, terima ${formatRp(2000)}`);
          handleLanding(playerId, diceTotal);
          break;
        }
        case 'collect':
          player.money += card.value;
          updateTurnPhaseAfterResolution(player);
          break;
        case 'pay':
          if (player.money < card.value) {
            bankruptPlayer(playerId);
            broadcastLog(`💀 ${player.name} bangkrut!`);
            emitBroadcast('player-bankrupt', { playerId });
          } else {
            player.money -= card.value;
          }
          updateTurnPhaseAfterResolution(player);
          break;
        case 'jail':
          sendToJail(player);
          updateTurnPhaseAfterResolution(player);
          break;
        case 'jail-free':
          player.jailFreeCards++;
          updateTurnPhaseAfterResolution(player);
          break;
        case 'repair': {
          let cost = 0;
          player.properties.forEach(id => {
            const s = room.boardState[id];
            if (!s) return;
            cost += s.hotel ? card.value[1] : s.houses * card.value[0];
          });
          if (cost > 0) broadcastLog(`🛠️ ${player.name} membayar biaya renovasi ${formatRp(cost)}`);
          if (player.money < cost) {
            bankruptPlayer(playerId);
            broadcastLog(`💀 ${player.name} bangkrut karena biaya renovasi!`);
            emitBroadcast('player-bankrupt', { playerId });
          } else {
            player.money -= cost;
          }
          updateTurnPhaseAfterResolution(player);
          break;
        }
        case 'collect-each': {
          const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
          others.forEach(p => {
            const paid = Math.min(p.money, card.value);
            p.money -= paid;
            player.money += paid;
            if (p.money <= 0 && paid < card.value) {
              bankruptPlayer(p.id, playerId);
              broadcastLog(`💀 ${p.name} bangkrut!`);
              emitBroadcast('player-bankrupt', { playerId: p.id });
            }
          });
          updateTurnPhaseAfterResolution(player);
          break;
        }
        case 'pay-each': {
          const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
          const totalRequired = others.length * card.value;
          if (player.money < totalRequired) {
            bankruptPlayer(playerId);
            broadcastLog(`💀 ${player.name} bangkrut!`);
            emitBroadcast('player-bankrupt', { playerId });
          } else {
            others.forEach(p => {
              player.money -= card.value;
              p.money += card.value;
            });
          }
          updateTurnPhaseAfterResolution(player);
          break;
        }
        default:
          updateTurnPhaseAfterResolution(player);
          break;
      }
    }

    function handleLanding(playerId, diceTotal) {
      const player = room.players.get(playerId);
      if (!player || player.bankrupt) return;
      const space = properties[player.position];

      switch (space.type) {
        case 'property':
        case 'airport':
        case 'utility': {
          const state = room.boardState[player.position];
          if (!state.ownerId) {
            if (player.isBot) {
              const shouldBuy = botDecide(player, 'buy-property', { price: space.price });
              if (shouldBuy && buyProperty(playerId, player.position)) {
                broadcastLog(`🤖 ${player.name} membeli ${space.name} seharga ${formatRp(space.price)}`);
                updateTurnPhaseAfterResolution(player);
              } else {
                const hasHumanBidder = [...room.players.values()].some(p => !p.isBot && !p.bankrupt && p.money >= 100);
                if (hasHumanBidder) {
                  broadcastLog(`🔨 ${player.name} tidak membeli ${space.name}, lelang dimulai!`);
                  startAuction(player.position);
                  emitBroadcast('auction-start', {
                    propertyId: player.position,
                    space,
                    auctionState: getStateSnapshot().auctionState
                  });
                  setTimeout(() => handleBotAuction(), 800);
                } else {
                  broadcastLog(`🤖 ${player.name} melewati pembelian ${space.name}`);
                  updateTurnPhaseAfterResolution(player);
                }
              }
            } else {
              room.turnPhase = 'buying';
              emitBroadcast('buy-option', {
                playerId,
                propertyId: player.position,
                space,
                canAfford: player.money >= space.price
              });
            }
          } else if (state.ownerId !== playerId) {
            if (state.mortgaged) {
              broadcastLog(`${player.name} mendarat di ${space.name} (tergadai, bebas sewa)`);
            } else {
              const owner = room.players.get(state.ownerId);
              const rent = payRent(playerId, player.position, diceTotal);
              if (rent > 0 && owner) {
                broadcastLog(`💸 ${player.name} membayar sewa ${formatRp(rent)} ke ${owner.name} (${space.name})`);
                if (player.bankrupt) {
                  broadcastLog(`💀 ${player.name} bangkrut!`);
                  emitBroadcast('player-bankrupt', { playerId });
                }
              }
            }
            updateTurnPhaseAfterResolution(player);
          } else {
            updateTurnPhaseAfterResolution(player);
          }
          break;
        }
        case 'tax': {
          const amount = space.price;
          if (player.money < amount) {
            bankruptPlayer(playerId);
            broadcastLog(`💀 ${player.name} bangkrut karena tidak sanggup membayar ${space.name}!`);
            emitBroadcast('player-bankrupt', { playerId });
          } else {
            player.money -= amount;
            broadcastLog(`🏛️ ${player.name} membayar ${space.name} ${formatRp(amount)}`);
          }
          updateTurnPhaseAfterResolution(player);
          break;
        }
        case 'go-to-jail':
          sendToJail(player);
          broadcastLog(`🚔 ${player.name} masuk penjara!`);
          updateTurnPhaseAfterResolution(player);
          break;
        case 'chance':
        case 'community': {
          const card = drawCard(space.type);
          emitBroadcast('card-drawn', { playerId, playerName: player.name, card, type: space.type });
          broadcastLog(`🃏 ${player.name} mengambil kartu ${space.type === 'chance' ? 'Kesempatan' : 'Dana Umum'}: "${card.text}"`);
          executeCard(playerId, card, diceTotal);
          break;
        }
        default:
          updateTurnPhaseAfterResolution(player);
          break;
      }
    }

    function tryBotBuildBuildings(bot) {
      if (!room || !bot || bot.bankrupt) return;
      for (const propId of bot.properties) {
        const space = properties[propId];
        if (!space || space.type !== 'property') continue;
        if (!botDecide(bot, 'build', { houseCost: space.houseCost })) continue;

        if (canBuildHotel(bot.id, propId, room.boardState) && bot.money >= space.houseCost) {
          bot.money -= space.houseCost;
          room.boardState[propId].houses = 0;
          room.boardState[propId].hotel = true;
          broadcastLog(`🤖 ${bot.name} membangun Hotel di ${space.name}!`);
        } else if (canBuildHouse(bot.id, propId, room.boardState) && bot.money >= space.houseCost) {
          bot.money -= space.houseCost;
          room.boardState[propId].houses++;
          broadcastLog(`🤖 ${bot.name} membangun rumah di ${space.name}`);
        }
      }
    }

    function advanceToNextTurn() {
      if (!room || room.state !== 'playing') return;
      const winCheck = checkWinCondition();
      if (winCheck) {
        broadcastRoomState();
        emitBroadcast('game-over', { winnerId: winCheck.winner });
        return;
      }

      let safety = 0;
      do {
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.turnOrder.length;
        safety++;
      } while (
        room.players.get(room.turnOrder[room.currentPlayerIndex])?.bankrupt &&
        safety <= room.turnOrder.length
      );

      const current = getCurrentPlayer();
      if (current) current.doublesCount = 0;
      room.turnPhase = 'roll';
      room.lastDice = null;
      room.escapedJailByDouble = false;

      broadcastRoomState();
      processBotTurn();
    }

    function processBotTurn() {
      if (!room || room.state !== 'playing' || room.botThinking) return;
      const bot = getCurrentPlayer();
      if (!bot || !bot.isBot || bot.bankrupt) return;

      room.botThinking = true;
      setTimeout(() => {
        if (!room || room.state !== 'playing') {
          if (room) room.botThinking = false;
          return;
        }
        const currentBot = getCurrentPlayer();
        if (!currentBot || currentBot.id !== bot.id || currentBot.bankrupt) {
          room.botThinking = false;
          return;
        }

        const dice = rollDice();
        room.lastDice = dice;
        room.escapedJailByDouble = false;
        const wasInJail = currentBot.inJail;

        if (currentBot.inJail) {
          const decision = botDecide(currentBot, 'jail', {});
          if (decision === 'card' && currentBot.jailFreeCards > 0) {
            currentBot.jailFreeCards--;
            currentBot.inJail = false;
            currentBot.jailTurns = 0;
            broadcastLog(`🤖 ${currentBot.name} menggunakan Kartu Bebas Penjara!`);
          } else if (decision === 'pay' && currentBot.money >= 500) {
            currentBot.money -= 500;
            currentBot.inJail = false;
            currentBot.jailTurns = 0;
            broadcastLog(`🤖 ${currentBot.name} membayar ${formatRp(500)} untuk keluar penjara`);
          } else if (dice.isDouble) {
            currentBot.inJail = false;
            currentBot.jailTurns = 0;
            room.escapedJailByDouble = true;
            broadcastLog(`🤖 ${currentBot.name} melempar double (${dice.d1}+${dice.d2}) dan bebas dari penjara!`);
          } else {
            currentBot.jailTurns++;
            if (currentBot.jailTurns >= 3) {
              if (currentBot.money >= 500) {
                currentBot.money -= 500;
                currentBot.inJail = false;
                currentBot.jailTurns = 0;
                broadcastLog(`🤖 ${currentBot.name} wajib membayar ${formatRp(500)} keluar penjara`);
              } else {
                bankruptPlayer(currentBot.id);
                broadcastLog(`💀 ${currentBot.name} bangkrut karena tidak sanggup keluar penjara!`);
                emitBroadcast('player-bankrupt', { playerId: currentBot.id });
                room.botThinking = false;
                advanceToNextTurn();
                return;
              }
            } else {
              broadcastLog(`🤖 ${currentBot.name} gagal keluar penjara (${currentBot.jailTurns}/3)`);
              emitBroadcast('dice-result', { playerId: currentBot.id, dice, inJail: true });
              room.botThinking = false;
              advanceToNextTurn();
              return;
            }
          }
        }

        if (dice.isDouble && !(wasInJail && room.escapedJailByDouble)) {
          currentBot.doublesCount++;
          if (currentBot.doublesCount >= 3) {
            sendToJail(currentBot);
            broadcastLog(`🤖 ${currentBot.name} melempar 3x double berturut! Masuk penjara!`);
            emitBroadcast('dice-result', { playerId: currentBot.id, dice, inJail: true });
            room.botThinking = false;
            advanceToNextTurn();
            return;
          }
        }

        const moveResult = movePlayer(currentBot, dice.total);
        emitBroadcast('dice-result', { playerId: currentBot.id, dice, moveResult });
        if (moveResult.passedStart) {
          broadcastLog(`🤖 ${currentBot.name} melewati START, terima ${formatRp(2000)}`);
        }
        const space = properties[currentBot.position];
        broadcastLog(`🤖 ${currentBot.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);

        const animWaitMs = 1250 + (dice.total * 175);
        setTimeout(() => {
          if (!room || room.state !== 'playing') {
            if (room) room.botThinking = false;
            return;
          }
          handleLanding(currentBot.id, dice.total);
          if (room.turnPhase === 'auction') {
            broadcastRoomState();
            room.botThinking = false;
            return;
          }
          tryBotBuildBuildings(currentBot);
          broadcastRoomState();
          if (checkAndBroadcastGameOver()) {
            room.botThinking = false;
            return;
          }
          if (dice.isDouble && !currentBot.bankrupt && !currentBot.inJail && !room.escapedJailByDouble) {
            room.botThinking = false;
            setTimeout(() => processBotTurn(), 900);
          } else {
            room.botThinking = false;
            advanceToNextTurn();
          }
        }, animWaitMs);
      }, 900);
    }

    function executeTrade(fromId, toId, offer) {
      const from = room.players.get(fromId);
      const to = room.players.get(toId);
      if (!from || !to || from.bankrupt || to.bankrupt) return false;
      const fromMoney = Math.max(0, Number(offer.fromMoney) || 0);
      const toMoney = Math.max(0, Number(offer.toMoney) || 0);
      const fromProperties = Array.isArray(offer.fromProperties) ? offer.fromProperties : [];
      const toProperties = Array.isArray(offer.toProperties) ? offer.toProperties : [];
      if (from.money < fromMoney || to.money < toMoney) return false;
      if (fromMoney === 0 && toMoney === 0 && fromProperties.length === 0 && toProperties.length === 0) return false;

      const hasGroupBuildings = (propId) => {
        const space = properties[propId];
        if (!space || !space.group) return false;
        return properties
          .filter(p => p.group === space.group)
          .some(p => room.boardState[p.id] && (room.boardState[p.id].houses > 0 || room.boardState[p.id].hotel));
      };

      for (const id of fromProperties) {
        const s = room.boardState[id];
        if (!s || s.ownerId !== fromId || s.houses > 0 || s.hotel || hasGroupBuildings(id)) return false;
      }
      for (const id of toProperties) {
        const s = room.boardState[id];
        if (!s || s.ownerId !== toId || s.houses > 0 || s.hotel || hasGroupBuildings(id)) return false;
      }

      from.money -= fromMoney;
      to.money += fromMoney;
      to.money -= toMoney;
      from.money += toMoney;
      fromProperties.forEach(id => {
        room.boardState[id].ownerId = toId;
        from.properties = from.properties.filter(p => p !== id);
        to.properties.push(id);
      });
      toProperties.forEach(id => {
        room.boardState[id].ownerId = fromId;
        to.properties = to.properties.filter(p => p !== id);
        from.properties.push(id);
      });
      return true;
    }

    function handleClientEvent(senderId, event, payload = {}, callback) {
      if (event === 'rejoin') {
        if (!room) {
          if (typeof callback === 'function') callback({ error: 'Room belum aktif' });
          return;
        }
        const p = room.players.get(senderId);
        if (p) p.connected = true;
        if (typeof callback === 'function') callback({ newPlayerId: senderId, logs: room.logs });
        broadcastRoomState();
        return;
      }

      if (!room) return;

      switch (event) {
        case 'add-bot':
          if (senderId === room.hostId) addBotToLobby();
          break;
        case 'start-game':
          if (senderId === room.hostId) startLobbyGame(false);
          break;
        case 'roll-dice': {
          if (room.state !== 'playing' || room.turnPhase !== 'roll') return;
          const current = getCurrentPlayer();
          if (!current || current.id !== senderId) return;

          const dice = rollDice();
          room.lastDice = dice;
          room.escapedJailByDouble = false;
          const wasInJail = current.inJail;

          if (current.inJail) {
            if (dice.isDouble) {
              current.inJail = false;
              current.jailTurns = 0;
              room.escapedJailByDouble = true;
              broadcastLog(`🔓 ${current.name} melempar double (${dice.d1}+${dice.d2}) dan bebas dari penjara!`);
            } else {
              current.jailTurns++;
              if (current.jailTurns >= 3) {
                if (current.money >= 500) {
                  current.money -= 500;
                  current.inJail = false;
                  current.jailTurns = 0;
                  broadcastLog(`🔓 ${current.name} membayar denda wajib ${formatRp(500)} untuk keluar penjara`);
                } else {
                  bankruptPlayer(current.id);
                  broadcastLog(`💀 ${current.name} bangkrut karena tidak sanggup membayar denda penjara!`);
                  emitBroadcast('player-bankrupt', { playerId: current.id });
                  advanceToNextTurn();
                  return;
                }
              } else {
                broadcastLog(`🔒 ${current.name} gagal lempar double di penjara (percobaan ${current.jailTurns}/3)`);
                room.turnPhase = 'end';
                emitBroadcast('dice-result', { playerId: current.id, dice, inJail: true });
                broadcastRoomState();
                setTimeout(() => advanceToNextTurn(), 1400);
                return;
              }
            }
          }

          if (dice.isDouble && !(wasInJail && room.escapedJailByDouble)) {
            current.doublesCount++;
            if (current.doublesCount >= 3) {
              sendToJail(current);
              room.turnPhase = 'end';
              broadcastLog(`🚔 ${current.name} melempar 3x double berturut-turut! Langsung masuk penjara!`);
              emitBroadcast('dice-result', { playerId: current.id, dice, inJail: true });
              broadcastRoomState();
              setTimeout(() => advanceToNextTurn(), 1400);
              return;
            }
          }

          const moveResult = movePlayer(current, dice.total);
          const space = properties[current.position];
          emitBroadcast('dice-result', { playerId: current.id, dice, moveResult });
          if (moveResult.passedStart) {
            broadcastLog(`🏁 ${current.name} melewati START, terima ${formatRp(2000)}!`);
          }
          broadcastLog(`🎲 ${current.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);
          handleLanding(current.id, dice.total);
          broadcastRoomState();
          if (checkAndBroadcastGameOver()) return;
          if (current.bankrupt || current.inJail) {
            setTimeout(() => advanceToNextTurn(), 1600 + (dice.total * 175));
          }
          break;
        }
        case 'buy-property': {
          if (room.state !== 'playing' || room.turnPhase !== 'buying') return;
          const current = getCurrentPlayer();
          if (!current || current.id !== senderId) return;
          const space = properties[current.position];
          if (payload.buy && buyProperty(senderId, current.position)) {
            broadcastLog(`🏠 ${current.name} membeli ${space.name} seharga ${formatRp(space.price)}`);
            updateTurnPhaseAfterResolution(current);
            broadcastRoomState();
          } else {
            broadcastLog(`🔨 ${current.name} melewati ${space.name}, lelang dimulai!`);
            startAuction(current.position);
            emitBroadcast('auction-start', {
              propertyId: current.position,
              space,
              auctionState: getStateSnapshot().auctionState
            });
            broadcastRoomState();
            setTimeout(() => handleBotAuction(), 800);
          }
          break;
        }
        case 'place-bid': {
          const numericAmount = Number(payload.amount);
          if (placeBid(senderId, numericAmount)) {
            const p = room.players.get(senderId);
            broadcastLog(`🔨 ${p.name} menawar ${formatRp(numericAmount)}`);
            if (isAuctionComplete()) {
              emitAuctionEnd(endAuction());
            } else {
              emitBroadcast('auction-update', getStateSnapshot().auctionState);
              broadcastRoomState();
              setTimeout(() => handleBotAuction(), 700);
            }
          }
          break;
        }
        case 'pass-auction': {
          if (!room.auctionState) return;
          const p = room.players.get(senderId);
          if (p) broadcastLog(`🏳️ ${p.name} pass lelang`);
          room.auctionState.passed.add(senderId);
          if (isAuctionComplete()) {
            emitAuctionEnd(endAuction());
          } else {
            emitBroadcast('auction-update', getStateSnapshot().auctionState);
            broadcastRoomState();
            setTimeout(() => handleBotAuction(), 600);
          }
          break;
        }
        case 'build-house': {
          const player = room.players.get(senderId);
          const space = properties[payload.propertyId];
          if (player && space && canBuildHouse(senderId, payload.propertyId, room.boardState) && player.money >= space.houseCost) {
            player.money -= space.houseCost;
            room.boardState[payload.propertyId].houses++;
            broadcastLog(`🏠 ${player.name} membangun rumah di ${space.name}`);
            broadcastRoomState();
          }
          break;
        }
        case 'build-hotel': {
          const player = room.players.get(senderId);
          const space = properties[payload.propertyId];
          if (player && space && canBuildHotel(senderId, payload.propertyId, room.boardState) && player.money >= space.houseCost) {
            player.money -= space.houseCost;
            room.boardState[payload.propertyId].houses = 0;
            room.boardState[payload.propertyId].hotel = true;
            broadcastLog(`🏨 ${player.name} membangun hotel di ${space.name}`);
            broadcastRoomState();
          }
          break;
        }
        case 'sell-building': {
          const player = room.players.get(senderId);
          const space = properties[payload.propertyId];
          const s = room.boardState[payload.propertyId];
          if (player && space && s && canSellBuilding(senderId, payload.propertyId, room.boardState)) {
            const refund = Math.floor(space.houseCost / 2);
            if (s.hotel) { s.hotel = false; s.houses = 4; } else { s.houses--; }
            player.money += refund;
            broadcastLog(`💰 ${player.name} menjual bangunan di ${space.name} (+${formatRp(refund)})`);
            broadcastRoomState();
          }
          break;
        }
        case 'mortgage': {
          const player = room.players.get(senderId);
          const space = properties[payload.propertyId];
          const s = room.boardState[payload.propertyId];
          if (!player || !space || !s || s.ownerId !== senderId || s.mortgaged || s.houses > 0 || s.hotel) break;
          if (space.group && properties.filter(p => p.group === space.group).some(p => room.boardState[p.id] && (room.boardState[p.id].houses > 0 || room.boardState[p.id].hotel))) break;
          s.mortgaged = true;
          player.money += Math.floor(space.price / 2);
          broadcastLog(`💳 ${player.name} menggadaikan ${space.name}`);
          broadcastRoomState();
          break;
        }
        case 'unmortgage': {
          const player = room.players.get(senderId);
          const space = properties[payload.propertyId];
          const s = room.boardState[payload.propertyId];
          if (!player || !space || !s || s.ownerId !== senderId || !s.mortgaged) break;
          const cost = Math.floor(Math.floor(space.price / 2) * 1.1);
          if (player.money < cost) break;
          player.money -= cost;
          s.mortgaged = false;
          broadcastLog(`🔓 ${player.name} menebus ${space.name}`);
          broadcastRoomState();
          break;
        }
        case 'trade-offer': {
          const target = room.players.get(payload.toId);
          const offer = payload.offer || {};
          if (!target) break;
          if (target.isBot) {
            const fromVal = (Number(offer.fromMoney) || 0) + (offer.fromProperties || []).reduce((acc, id) => acc + (properties[id]?.price || 0), 0);
            const toVal = (Number(offer.toMoney) || 0) + (offer.toProperties || []).reduce((acc, id) => acc + (properties[id]?.price || 0), 0);
            const fairForBot = fromVal >= toVal * 1.1 && target.money >= (Number(offer.toMoney) || 0);
            setTimeout(() => {
              if (fairForBot && executeTrade(senderId, target.id, offer)) {
                const from = room.players.get(senderId);
                broadcastLog(`🤝 Trade disetujui antara ${from.name} dan ${target.name}!`);
                broadcastRoomState();
                emitBroadcast('trade-result', { accepted: true, fromId: senderId, toId: target.id });
              } else {
                broadcastLog(`🤖 ${target.name} menolak tawaran trade`);
                emitBroadcast('trade-result', { accepted: false, fromId: senderId, toId: target.id });
              }
            }, 500);
          } else {
            emitBroadcast('trade-proposal', { fromId: senderId, toId: payload.toId, offer });
          }
          break;
        }
        case 'trade-respond': {
          if (payload.accepted) {
            if (executeTrade(payload.fromId, senderId, payload.offer)) {
              const from = room.players.get(payload.fromId);
              const to = room.players.get(senderId);
              broadcastLog(`🤝 Trade berhasil antara ${from.name} dan ${to.name}`);
              broadcastRoomState();
            }
          }
          emitBroadcast('trade-result', { accepted: Boolean(payload.accepted), fromId: payload.fromId, toId: senderId });
          break;
        }
        case 'pay-jail': {
          if (room.state !== 'playing' || room.turnPhase !== 'roll') break;
          const current = getCurrentPlayer();
          if (!current || current.id !== senderId || !current.inJail || current.money < 500) break;
          current.money -= 500;
          current.inJail = false;
          current.jailTurns = 0;
          broadcastLog(`🔓 ${current.name} membayar ${formatRp(500)} untuk keluar penjara`);
          broadcastRoomState();
          break;
        }
        case 'use-jail-free': {
          if (room.state !== 'playing' || room.turnPhase !== 'roll') break;
          const current = getCurrentPlayer();
          if (!current || current.id !== senderId || !current.inJail || current.jailFreeCards <= 0) break;
          current.jailFreeCards--;
          current.inJail = false;
          current.jailTurns = 0;
          broadcastLog(`🃏 ${current.name} menggunakan Kartu Bebas Penjara!`);
          broadcastRoomState();
          break;
        }
        case 'chat-message': {
          const p = room.players.get(senderId);
          const cleanMsg = String(payload.message || '').trim().slice(0, 200);
          if (p && cleanMsg) {
            emitBroadcast('chat-message', { playerId: senderId, name: p.name, message: cleanMsg, timestamp: Date.now() });
          }
          break;
        }
        case 'end-turn': {
          if (room.state !== 'playing') return;
          const current = getCurrentPlayer();
          if (!current || current.id !== senderId) return;
          if (room.turnPhase === 'buying') room.turnPhase = 'end';
          if (room.turnPhase === 'auction' && room.auctionState) emitAuctionEnd(endAuction());
          advanceToNextTurn();
          break;
        }
      }
    }

    return {
      ensureDataLoaded,
      createLobbyRoom,
      joinLobbyPlayer,
      addBotToLobby,
      removePlayer,
      startLobbyGame,
      startQuickGame,
      handleClientEvent,
      getStateSnapshot,
      getLogs: () => (room ? [...room.logs] : []),
      onBroadcast(fn) { broadcastHandlers.push(fn); },
      onDirect(fn) { directHandlers.push(fn); }
    };
  }

  function createLocalMonopolySocket(options = {}) {
    const engine = createLocalMonopolyEngine(options);
    const listeners = new Map();
    const humanSocketId = 'local-player-1';

    engine.onBroadcast((event, payload) => {
      const fns = listeners.get(event) || [];
      fns.forEach(fn => {
        try {
          fn(payload);
        } catch (err) {
          console.error('[LocalSocket listener error]', event, err);
        }
      });
    });

    return {
      isLocal: true,
      id: humanSocketId,
      on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(fn);
      },
      emit(event, payload = {}, callback) {
        if (event === 'quick-start') {
          engine.startQuickGame(humanSocketId, payload.name, payload.token, payload.botCount || 3)
            .then(res => {
              if (typeof callback === 'function') callback(res);
              const fns = listeners.get('room-state') || [];
              const snap = engine.getStateSnapshot();
              fns.forEach(fn => fn(snap));
            })
            .catch(err => {
              if (typeof callback === 'function') callback({ success: false, error: err.message });
            });
          return;
        }
        engine.handleClientEvent(humanSocketId, event, payload, callback);
      },
      _getRoomState: () => engine.getStateSnapshot()
    };
  }

  root.createLocalMonopolyEngine = createLocalMonopolyEngine;
  root.createLocalMonopolySocket = createLocalMonopolySocket;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { createLocalMonopolyEngine, createLocalMonopolySocket };
  }
})(typeof window !== 'undefined' ? window : globalThis);
