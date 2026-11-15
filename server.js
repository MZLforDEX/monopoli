const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const GameRoom = require('./game/GameRoom');
const Bot = require('./game/Bot');
const rules = require('./game/rules');
const properties = require('./public/data/properties.json');

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let safePath = path.normalize(urlPath === '/' ? 'index.html' : urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  let filePath = path.join(__dirname, 'public', safePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const io = new Server(server, { cors: { origin: '*' } });

const rooms = new Map(); // code -> GameRoom
const playerRooms = new Map(); // socketId -> roomCode

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'NUS-';
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  while (rooms.has(code)) {
    code = 'NUS-';
    for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function broadcastRoomState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('room-state', room.getState());
}

function broadcastLog(roomCode, message) {
  const room = rooms.get(roomCode);
  const entry = room ? room.addLog(message) : { message, timestamp: Date.now() };
  io.to(roomCode).emit('game-log', entry);
}

function checkAndBroadcastGameOver(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return false;
  const win = room.checkWinCondition();
  if (win) {
    broadcastRoomState(roomCode);
    io.to(roomCode).emit('game-over', { winnerId: win.winner });
    return true;
  }
  return false;
}

function advanceToNextTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.state !== 'playing') return;
  const nextResult = room.nextTurn();
  broadcastRoomState(roomCode);
  if (nextResult.type === 'game-over') {
    io.to(roomCode).emit('game-over', { winnerId: nextResult.winner });
  } else {
    processBotTurn(roomCode);
  }
}

function tryBotBuildBuildings(roomCode, bot) {
  const room = rooms.get(roomCode);
  if (!room || !bot || bot.bankrupt) return;

  for (const propId of bot.properties) {
    const space = properties[propId];
    if (!space || space.type !== 'property') continue;
    if (!Bot.decide(bot, 'build', { houseCost: space.houseCost })) continue;

    if (rules.canBuildHotel(bot.id, propId, room.boardState)) {
      if (room.buildHotel(bot.id, propId)) {
        broadcastLog(roomCode, `🤖 ${bot.name} membangun Hotel di ${space.name}!`);
      }
    } else if (rules.canBuildHouse(bot.id, propId, room.boardState)) {
      if (room.buildHouse(bot.id, propId)) {
        broadcastLog(roomCode, `🤖 ${bot.name} membangun rumah di ${space.name}`);
      }
    }
  }
}

function processBotTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.state !== 'playing' || room.botThinking) return;
  const player = room.getCurrentPlayer();
  if (!player || !player.isBot || player.bankrupt) return;

  room.botThinking = true;

  setTimeout(() => {
    const activeRoom = rooms.get(roomCode);
    if (!activeRoom || activeRoom.state !== 'playing') {
      if (activeRoom) activeRoom.botThinking = false;
      return;
    }
    const currentBot = activeRoom.getCurrentPlayer();
    if (!currentBot || currentBot.id !== player.id || currentBot.bankrupt) {
      activeRoom.botThinking = false;
      return;
    }

    const dice = rules.rollDice();
    activeRoom.lastDice = dice;

    if (currentBot.inJail) {
      const decision = Bot.decide(currentBot, 'jail', {});
      if (decision === 'card' && currentBot.jailFreeCards > 0) {
        currentBot.jailFreeCards--;
        currentBot.inJail = false;
        currentBot.jailTurns = 0;
        broadcastLog(roomCode, `🤖 ${currentBot.name} menggunakan Kartu Bebas Penjara!`);
      } else if (decision === 'pay' && currentBot.money >= 500) {
        currentBot.money -= 500;
        currentBot.inJail = false;
        currentBot.jailTurns = 0;
        broadcastLog(roomCode, `🤖 ${currentBot.name} membayar Rp500rb untuk keluar penjara`);
      } else if (dice.isDouble) {
        currentBot.inJail = false;
        currentBot.jailTurns = 0;
        broadcastLog(roomCode, `🤖 ${currentBot.name} melempar double dan keluar penjara!`);
      } else {
        currentBot.jailTurns++;
        if (currentBot.jailTurns >= 3) {
          if (currentBot.money >= 500) {
            currentBot.money -= 500;
            currentBot.inJail = false;
            currentBot.jailTurns = 0;
            broadcastLog(roomCode, `🤖 ${currentBot.name} wajib membayar Rp500rb keluar penjara`);
          } else {
            activeRoom.bankruptPlayer(currentBot.id);
            broadcastLog(roomCode, `💀 ${currentBot.name} bangkrut karena tidak sanggup keluar penjara!`);
            io.to(roomCode).emit('player-bankrupt', { playerId: currentBot.id });
            activeRoom.botThinking = false;
            advanceToNextTurn(roomCode);
            return;
          }
        } else {
          broadcastLog(roomCode, `🤖 ${currentBot.name} gagal keluar penjara (${currentBot.jailTurns}/3)`);
          io.to(roomCode).emit('dice-result', { playerId: currentBot.id, dice, inJail: true });
          activeRoom.botThinking = false;
          advanceToNextTurn(roomCode);
          return;
        }
      }
    }

    if (dice.isDouble) {
      currentBot.doublesCount++;
      if (currentBot.doublesCount >= 3) {
        activeRoom.sendToJail(currentBot.id);
        broadcastLog(roomCode, `🤖 ${currentBot.name} melempar 3x double berturut! Masuk penjara!`);
        io.to(roomCode).emit('dice-result', { playerId: currentBot.id, dice, inJail: true });
        activeRoom.botThinking = false;
        advanceToNextTurn(roomCode);
        return;
      }
    }

    const moveResult = activeRoom.movePlayer(currentBot.id, dice.total);
    io.to(roomCode).emit('dice-result', { playerId: currentBot.id, dice, moveResult });

    if (moveResult.passedStart) {
      broadcastLog(roomCode, `🤖 ${currentBot.name} melewati START, terima Rp2.000rb`);
    }

    const space = properties[currentBot.position];
    broadcastLog(roomCode, `🤖 ${currentBot.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);

    const animWaitMs = 1250 + (dice.total * 175);
    setTimeout(() => {
      const r = rooms.get(roomCode);
      if (!r || r.state !== 'playing') {
        if (r) r.botThinking = false;
        return;
      }

      handleLanding(roomCode, currentBot.id, dice.total);
      tryBotBuildBuildings(roomCode, currentBot);
      broadcastRoomState(roomCode);

      if (checkAndBroadcastGameOver(roomCode)) {
        r.botThinking = false;
        return;
      }

      if (dice.isDouble && !currentBot.bankrupt && !currentBot.inJail) {
        r.botThinking = false;
        setTimeout(() => processBotTurn(roomCode), 900);
      } else {
        r.botThinking = false;
        advanceToNextTurn(roomCode);
      }
    }, animWaitMs);
  }, 900);
}

function updateTurnPhaseAfterResolution(room, player) {
  if (!room || !player) return;
  if (player.bankrupt || player.inJail) {
    room.turnPhase = 'end';
  } else if (room.lastDice && room.lastDice.isDouble) {
    room.turnPhase = 'roll';
  } else {
    room.turnPhase = 'end';
  }
}

function handleLanding(roomCode, playerId, diceTotal) {
  const room = rooms.get(roomCode);
  if (!room) return;
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
          const shouldBuy = Bot.decide(player, 'buy-property', { price: space.price });
          if (shouldBuy && room.buyProperty(playerId, player.position)) {
            broadcastLog(roomCode, `🤖 ${player.name} membeli ${space.name} seharga Rp${space.price.toLocaleString('id-ID')}rb`);
          } else {
            broadcastLog(roomCode, `🤖 ${player.name} melewati pembelian ${space.name}`);
          }
          updateTurnPhaseAfterResolution(room, player);
        } else {
          room.turnPhase = 'buying';
          io.to(roomCode).emit('buy-option', {
            playerId,
            propertyId: player.position,
            space,
            canAfford: player.money >= space.price
          });
        }
      } else if (state.ownerId !== playerId) {
        if (state.mortgaged) {
          broadcastLog(roomCode, `${player.name} mendarat di ${space.name} (tergadai, bebas sewa)`);
        } else {
          const owner = room.players.get(state.ownerId);
          const rent = room.payRent(playerId, player.position, diceTotal);
          if (rent > 0 && owner) {
            broadcastLog(roomCode, `💸 ${player.name} membayar sewa Rp${rent.toLocaleString('id-ID')}rb ke ${owner.name} (${space.name})`);
            if (player.bankrupt) {
              broadcastLog(roomCode, `💀 ${player.name} bangkrut!`);
              io.to(roomCode).emit('player-bankrupt', { playerId });
            }
          }
        }
        updateTurnPhaseAfterResolution(room, player);
      } else {
        updateTurnPhaseAfterResolution(room, player);
      }
      break;
    }
    case 'tax': {
      const amount = space.price;
      if (player.money < amount) {
        room.bankruptPlayer(playerId);
        broadcastLog(roomCode, `💀 ${player.name} bangkrut karena tidak sanggup membayar ${space.name}!`);
        io.to(roomCode).emit('player-bankrupt', { playerId });
      } else {
        player.money -= amount;
        broadcastLog(roomCode, `🏛️ ${player.name} membayar ${space.name} Rp${amount.toLocaleString('id-ID')}rb`);
      }
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
    case 'go-to-jail': {
      room.sendToJail(playerId);
      broadcastLog(roomCode, `🚔 ${player.name} masuk penjara!`);
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
    case 'chance':
    case 'community': {
      const card = room.drawCard(space.type);
      io.to(roomCode).emit('card-drawn', { playerId, playerName: player.name, card, type: space.type });
      broadcastLog(roomCode, `🃏 ${player.name} mengambil kartu ${space.type === 'chance' ? 'Kesempatan' : 'Dana Umum'}: "${card.text}"`);
      executeCard(roomCode, playerId, card, diceTotal);
      break;
    }
    default: {
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
  }
}

function executeCard(roomCode, playerId, card, diceTotal) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const player = room.players.get(playerId);
  if (!player) return;

  switch (card.action) {
    case 'move': {
      const moveRes = room.movePlayerTo(playerId, card.value);
      if (moveRes.passedStart) {
        broadcastLog(roomCode, `${player.name} melewati START, terima Rp2.000rb`);
      }
      handleLanding(roomCode, playerId, diceTotal);
      break;
    }
    case 'move-back': {
      const newPos = (player.position - card.value + 40) % 40;
      player.position = newPos;
      handleLanding(roomCode, playerId, diceTotal);
      break;
    }
    case 'move-nearest': {
      let pos = player.position;
      const targetType = card.value;
      do { pos = (pos + 1) % 40; } while (properties[pos].type !== targetType);
      const moveRes = room.movePlayerTo(playerId, pos);
      if (moveRes.passedStart) {
        broadcastLog(roomCode, `${player.name} melewati START, terima Rp2.000rb`);
      }
      handleLanding(roomCode, playerId, diceTotal);
      break;
    }
    case 'collect':
      player.money += card.value;
      updateTurnPhaseAfterResolution(room, player);
      break;
    case 'pay':
      if (player.money < card.value) {
        room.bankruptPlayer(playerId);
        broadcastLog(roomCode, `💀 ${player.name} bangkrut!`);
        io.to(roomCode).emit('player-bankrupt', { playerId });
      } else {
        player.money -= card.value;
      }
      updateTurnPhaseAfterResolution(room, player);
      break;
    case 'jail':
      room.sendToJail(playerId);
      updateTurnPhaseAfterResolution(room, player);
      break;
    case 'jail-free':
      player.jailFreeCards++;
      updateTurnPhaseAfterResolution(room, player);
      break;
    case 'repair': {
      let cost = 0;
      player.properties.forEach(id => {
        const s = room.boardState[id];
        if (!s) return;
        if (s.hotel) cost += card.value[1];
        else cost += s.houses * card.value[0];
      });
      if (cost > 0) {
        broadcastLog(roomCode, `🛠️ ${player.name} membayar biaya renovasi Rp${cost.toLocaleString('id-ID')}rb`);
      }
      if (player.money < cost) {
        room.bankruptPlayer(playerId);
        broadcastLog(roomCode, `💀 ${player.name} bangkrut karena biaya renovasi!`);
        io.to(roomCode).emit('player-bankrupt', { playerId });
      } else {
        player.money -= cost;
      }
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
    case 'collect-each': {
      const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
      others.forEach(p => {
        const paid = Math.min(p.money, card.value);
        p.money -= paid;
        player.money += paid;
        if (p.money <= 0 && paid < card.value) {
          room.bankruptPlayer(p.id, playerId);
          broadcastLog(roomCode, `💀 ${p.name} bangkrut!`);
          io.to(roomCode).emit('player-bankrupt', { playerId: p.id });
        }
      });
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
    case 'pay-each': {
      const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
      const totalRequired = others.length * card.value;
      if (player.money < totalRequired) {
        room.bankruptPlayer(playerId);
        broadcastLog(roomCode, `💀 ${player.name} bangkrut!`);
        io.to(roomCode).emit('player-bankrupt', { playerId });
      } else {
        others.forEach(p => {
          player.money -= card.value;
          p.money += card.value;
        });
      }
      updateTurnPhaseAfterResolution(room, player);
      break;
    }
    default:
      updateTurnPhaseAfterResolution(room, player);
      break;
  }
}

io.on('connection', (socket) => {
  socket.on('rejoin', ({ roomCode, playerId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room tidak ditemukan' });
      return;
    }

    const player = room.rejoinPlayer(playerId, socket.id);
    if (playerId && playerId !== socket.id) {
      playerRooms.delete(playerId);
    }
    playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);

    if (typeof callback === 'function') {
      callback({
        newPlayerId: player ? socket.id : playerId,
        logs: room.logs
      });
    }
    broadcastRoomState(roomCode);

    // If current turn is a bot and bot hasn't started rolling yet, start bot turn
    const current = room.getCurrentPlayer();
    if (room.state === 'playing' && current && current.isBot && !room.botThinking) {
      processBotTurn(roomCode);
    }
  });

  socket.on('create-room', ({ name, token }, callback) => {
    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id);
    room.addPlayer(socket.id, name, token || 'merah');
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);
    room.addLog(`🏝️ Room ${code} dibuat oleh ${name}`);
    if (typeof callback === 'function') {
      callback({ success: true, code, playerId: socket.id });
    }
    broadcastRoomState(code);
  });

  // 1-Click Quick Start vs Bots (also supports ?autostart=1)
  socket.on('quick-start', ({ name, token, botCount = 3 }, callback) => {
    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id);
    const chosenToken = token || 'merah';
    const playerName = (name && name.trim()) ? name.trim() : 'Nakhoda';
    room.addPlayer(socket.id, playerName, chosenToken, false);

    const numBots = Math.min(3, Math.max(1, Number(botCount) || 3));
    for (let i = 0; i < numBots; i++) {
      room.addBot();
    }

    room.startGame(true); // Host goes first so human has immediate control!
    room.addLog(`🎮 Permainan cepat dimulai di Room ${code}!`);
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);

    if (typeof callback === 'function') {
      callback({ success: true, code, playerId: socket.id, logs: room.logs });
    }
    broadcastRoomState(code);
  });

  socket.on('join-room', ({ code, name, token }, callback) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) return callback({ success: false, error: 'Room tidak ditemukan' });
    if (room.state !== 'lobby') return callback({ success: false, error: 'Permainan sudah dimulai' });
    if (room.players.size >= 4) return callback({ success: false, error: 'Room sudah penuh (maks 4 pemain)' });

    const player = room.addPlayer(socket.id, name, token);
    if (!player) return callback({ success: false, error: 'Pion tersebut sudah dipilih pemain lain!' });

    playerRooms.set(socket.id, cleanCode);
    socket.join(cleanCode);
    callback({ success: true, code: cleanCode, playerId: socket.id });
    broadcastLog(cleanCode, `👋 ${player.name} bergabung ke room!`);
    broadcastRoomState(cleanCode);
  });

  socket.on('add-bot', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostId) return;
    const bot = room.addBot();
    if (bot) {
      broadcastLog(code, `🤖 ${bot.name} ditambahkan ke room`);
      broadcastRoomState(code);
    }
  });

  socket.on('start-game', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || socket.id !== room.hostId) return;
    if (room.startGame(false)) {
      broadcastLog(code, '🎮 Permainan dimulai! Selamat menjelajahi Nusantara!');
      broadcastRoomState(code);
      setTimeout(() => processBotTurn(code), 1500);
    }
  });

  socket.on('roll-dice', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;
    if (room.turnPhase !== 'roll') return;

    const dice = rules.rollDice();
    room.lastDice = dice;

    if (current.inJail) {
      if (dice.isDouble) {
        current.inJail = false;
        current.jailTurns = 0;
        broadcastLog(code, `🔓 ${current.name} melempar double (${dice.d1}+${dice.d2}) dan bebas dari penjara!`);
      } else {
        current.jailTurns++;
        if (current.jailTurns >= 3) {
          if (current.money >= 500) {
            current.money -= 500;
            current.inJail = false;
            current.jailTurns = 0;
            broadcastLog(code, `🔓 ${current.name} membayar denda wajib Rp500rb untuk keluar penjara`);
          } else {
            room.bankruptPlayer(current.id);
            broadcastLog(code, `💀 ${current.name} bangkrut karena tidak sanggup membayar denda penjara!`);
            io.to(code).emit('player-bankrupt', { playerId: current.id });
            advanceToNextTurn(code);
            return;
          }
        } else {
          broadcastLog(code, `🔒 ${current.name} gagal lempar double di penjara (percobaan ${current.jailTurns}/3)`);
          room.turnPhase = 'end';
          io.to(code).emit('dice-result', { playerId: current.id, dice, inJail: true });
          broadcastRoomState(code);
          setTimeout(() => advanceToNextTurn(code), 1400);
          return;
        }
      }
    }

    if (dice.isDouble) {
      current.doublesCount++;
      if (current.doublesCount >= 3) {
        room.sendToJail(current.id);
        room.turnPhase = 'end';
        broadcastLog(code, `🚔 ${current.name} melempar 3x double berturut-turut! Langsung masuk penjara!`);
        io.to(code).emit('dice-result', { playerId: current.id, dice, inJail: true });
        broadcastRoomState(code);
        setTimeout(() => advanceToNextTurn(code), 1400);
        return;
      }
    }

    const moveResult = room.movePlayer(current.id, dice.total);
    const space = properties[current.position];

    io.to(code).emit('dice-result', { playerId: current.id, dice, moveResult });

    if (moveResult.passedStart) {
      broadcastLog(code, `🏁 ${current.name} melewati START, terima Rp2.000rb!`);
    }
    broadcastLog(code, `🎲 ${current.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);

    handleLanding(code, current.id, dice.total);
    broadcastRoomState(code);

    if (checkAndBroadcastGameOver(code)) return;

    if (current.bankrupt || current.inJail) {
      setTimeout(() => advanceToNextTurn(code), 1600 + (dice.total * 175));
    }
  });

  socket.on('buy-property', ({ buy }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;
    if (room.turnPhase !== 'buying') return;

    const space = properties[current.position];
    if (buy && room.buyProperty(socket.id, current.position)) {
      broadcastLog(code, `🏠 ${current.name} membeli ${space.name} seharga Rp${space.price.toLocaleString('id-ID')}rb`);
      updateTurnPhaseAfterResolution(room, current);
      broadcastRoomState(code);
    } else {
      broadcastLog(code, `🔨 ${current.name} melewati ${space.name}, lelang dimulai!`);
      room.startAuction(current.position);
      io.to(code).emit('auction-start', {
        propertyId: current.position,
        space,
        auctionState: room.getState().auctionState
      });
      broadcastRoomState(code);
      setTimeout(() => handleBotAuction(code), 800);
    }
  });

  socket.on('place-bid', ({ amount }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.auctionState) return;
    const numericAmount = Number(amount);
    if (room.placeBid(socket.id, numericAmount)) {
      const player = room.players.get(socket.id);
      broadcastLog(code, `🔨 ${player.name} menawar Rp${numericAmount.toLocaleString('id-ID')}rb`);

      if (room.isAuctionComplete()) {
        finishAuctionAndNotify(code);
      } else {
        io.to(code).emit('auction-update', room.getState().auctionState);
        broadcastRoomState(code);
        setTimeout(() => handleBotAuction(code), 700);
      }
    }
  });

  socket.on('pass-auction', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.auctionState) return;
    const player = room.players.get(socket.id);
    if (player) {
      broadcastLog(code, `🏳️ ${player.name} pass lelang`);
    }
    const result = room.passAuction(socket.id);
    if (!result) return;

    if (result.type === 'auction-end') {
      emitAuctionEnd(code, result);
    } else if (room.auctionState) {
      io.to(code).emit('auction-update', room.getState().auctionState);
      broadcastRoomState(code);
      setTimeout(() => handleBotAuction(code), 600);
    }
  });

  socket.on('build-house', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.buildHouse(socket.id, propertyId)) {
      broadcastLog(code, `🏠 ${room.players.get(socket.id).name} membangun rumah di ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('build-hotel', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.buildHotel(socket.id, propertyId)) {
      broadcastLog(code, `🏨 ${room.players.get(socket.id).name} membangun hotel di ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('sell-building', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const refund = room.sellBuilding(socket.id, propertyId);
    if (refund) {
      broadcastLog(code, `💰 ${room.players.get(socket.id).name} menjual bangunan di ${properties[propertyId].name} (+Rp${refund}rb)`);
      broadcastRoomState(code);
    }
  });

  socket.on('mortgage', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.mortgageProperty(socket.id, propertyId)) {
      broadcastLog(code, `💳 ${room.players.get(socket.id).name} menggadaikan ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('unmortgage', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.unmortgageProperty(socket.id, propertyId)) {
      broadcastLog(code, `🔓 ${room.players.get(socket.id).name} menebus ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('trade-offer', ({ toId, offer }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const target = room.players.get(toId);
    if (!target) return;

    // If trading with a Bot, evaluate automatically after a short delay
    if (target.isBot) {
      const fromVal = (Number(offer.fromMoney) || 0) + (offer.fromProperties || []).reduce((acc, id) => acc + (properties[id]?.price || 0), 0);
      const toVal = (Number(offer.toMoney) || 0) + (offer.toProperties || []).reduce((acc, id) => acc + (properties[id]?.price || 0), 0);
      const fairForBot = fromVal >= toVal * 1.1 && target.money >= (Number(offer.toMoney) || 0);
      setTimeout(() => {
        if (fairForBot && room.executeTrade(socket.id, toId, offer)) {
          const from = room.players.get(socket.id);
          broadcastLog(code, `🤝 Trade disetujui antara ${from.name} dan ${target.name}!`);
          broadcastRoomState(code);
          io.to(code).emit('trade-result', { accepted: true, fromId: socket.id, toId });
        } else {
          broadcastLog(code, `🤖 ${target.name} menolak tawaran trade`);
          io.to(code).emit('trade-result', { accepted: false, fromId: socket.id, toId });
        }
      }, 600);
      return;
    }

    io.to(code).emit('trade-proposal', { fromId: socket.id, toId, offer });
  });

  socket.on('trade-respond', ({ fromId, accepted, offer }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (accepted) {
      if (room.executeTrade(fromId, socket.id, offer)) {
        const from = room.players.get(fromId);
        const to = room.players.get(socket.id);
        broadcastLog(code, `🤝 Trade berhasil antara ${from.name} dan ${to.name}`);
        broadcastRoomState(code);
      }
    }
    io.to(code).emit('trade-result', { accepted, fromId, toId: socket.id });
  });

  socket.on('pay-jail', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || !player.inJail || player.money < 500) return;
    player.money -= 500;
    player.inJail = false;
    player.jailTurns = 0;
    broadcastLog(code, `🔓 ${player.name} membayar Rp500rb untuk keluar penjara`);
    broadcastRoomState(code);
  });

  socket.on('use-jail-free', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || !player.inJail || player.jailFreeCards <= 0) return;
    player.jailFreeCards--;
    player.inJail = false;
    player.jailTurns = 0;
    broadcastLog(code, `🃏 ${player.name} menggunakan Kartu Bebas Penjara!`);
    broadcastRoomState(code);
  });

  socket.on('chat-message', ({ message }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    const cleanMsg = String(message || '').trim().slice(0, 200);
    if (!cleanMsg) return;
    io.to(code).emit('chat-message', {
      playerId: socket.id,
      name: player.name,
      message: cleanMsg,
      timestamp: Date.now()
    });
  });

  socket.on('end-turn', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;
    // If player timed out during buying, auto-cancel auction/pass so game never deadlocks
    if (room.turnPhase === 'buying') {
      room.turnPhase = 'end';
    }
    if (room.turnPhase === 'auction' && room.auctionState) {
      finishAuctionAndNotify(code);
    }
    advanceToNextTurn(code);
  });

  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.connected = false;
    }

    if (room.state === 'lobby') {
      // Wait 5 seconds before removing in lobby in case of accidental refresh
      setTimeout(() => {
        const currRoom = rooms.get(code);
        if (!currRoom || currRoom.state !== 'lobby') return;
        const p = currRoom.players.get(socket.id);
        if (p && !p.connected) {
          const result = currRoom.removePlayer(socket.id);
          playerRooms.delete(socket.id);
          if (result === 'empty') {
            rooms.delete(code);
          } else {
            broadcastRoomState(code);
          }
        }
      }, 5000);
    } else {
      playerRooms.delete(socket.id);
      setTimeout(() => {
        const currentRoom = rooms.get(code);
        if (currentRoom) {
          const humanPlayers = [...currentRoom.players.values()].filter(p => !p.isBot);
          const allDisconnected = humanPlayers.length === 0 || humanPlayers.every(p => !p.connected);
          if (allDisconnected) {
            rooms.delete(code);
          }
        }
      }, 60000);
    }
  });
});

function emitAuctionEnd(roomCode, result) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('auction-end', result);
  if (result.winner) {
    const winner = room.players.get(result.winner);
    const propName = properties[result.propertyId]?.name || 'Properti';
    broadcastLog(roomCode, `🏆 ${winner ? winner.name : 'Pemain'} memenangkan lelang ${propName} seharga Rp${result.amount.toLocaleString('id-ID')}rb!`);
  } else {
    broadcastLog(roomCode, `🔨 Lelang berakhir tanpa pemenang.`);
  }
  broadcastRoomState(roomCode);
}

function finishAuctionAndNotify(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.auctionState) return;
  const result = room.endAuction();
  emitAuctionEnd(roomCode, result);
}

function handleBotAuction(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.auctionState) return;

  const auction = room.auctionState;
  const space = properties[auction.propertyId];

  for (const botId of auction.participants) {
    if (!room.auctionState) break;
    const bot = room.players.get(botId);
    if (!bot || !bot.isBot || auction.passed.has(botId) || auction.currentBidder === botId) continue;

    const decision = Bot.decide(bot, 'auction-bid', {
      price: space.price,
      currentBid: auction.currentBid
    });

    if (decision.bid && room.placeBid(botId, decision.amount)) {
      broadcastLog(roomCode, `🤖 ${bot.name} menawar Rp${decision.amount.toLocaleString('id-ID')}rb`);
    } else {
      const passRes = room.passAuction(botId);
      broadcastLog(roomCode, `🤖 ${bot.name} pass lelang`);
      if (passRes && passRes.type === 'auction-end') {
        emitAuctionEnd(roomCode, passRes);
        return;
      }
    }
  }

  if (!room.auctionState) return;

  if (room.isAuctionComplete()) {
    finishAuctionAndNotify(roomCode);
    return;
  }

  // If all remaining non-passed participants are bots, loop until one bot wins
  const activeHumans = auction.participants.filter(id => {
    const p = room.players.get(id);
    return p && !p.isBot && !auction.passed.has(id);
  });

  io.to(roomCode).emit('auction-update', room.getState().auctionState);
  broadcastRoomState(roomCode);

  if (activeHumans.length === 0) {
    setTimeout(() => handleBotAuction(roomCode), 500);
  }
}

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🎲 Monopoli Nusantara server running at http://localhost:${PORT}`);
  });
}

module.exports = { server, io, rooms };
