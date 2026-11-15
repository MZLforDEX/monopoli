const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const GameRoom = require('./game/GameRoom');
const Bot = require('./game/Bot');
const rules = require('./game/rules');
const properties = require('./public/data/properties.json');

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, 'public', urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg'
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
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
  io.to(roomCode).emit('game-log', { message, timestamp: Date.now() });
}

function processBotTurn(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || room.state !== 'playing') return;
  const player = room.getCurrentPlayer();
  if (!player || !player.isBot || player.bankrupt) return;

  setTimeout(() => {
    // Roll dice
    const dice = rules.rollDice();

    if (player.inJail) {
      const decision = Bot.decide(player, 'jail', {});
      if (decision === 'pay' && player.money >= 500) {
        player.money -= 500;
        player.inJail = false;
        player.jailTurns = 0;
        broadcastLog(roomCode, `🤖 ${player.name} membayar Rp500rb untuk keluar penjara`);
      } else if (dice.isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        broadcastLog(roomCode, `🤖 ${player.name} melempar double dan keluar penjara!`);
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          player.money -= 500;
          player.inJail = false;
          player.jailTurns = 0;
          broadcastLog(roomCode, `🤖 ${player.name} terpaksa membayar Rp500rb keluar penjara`);
        } else {
          broadcastLog(roomCode, `🤖 ${player.name} gagal keluar penjara`);
          io.to(roomCode).emit('dice-result', { playerId: player.id, dice, inJail: true });
          broadcastRoomState(roomCode);
          const nextResult = room.nextTurn();
          broadcastRoomState(roomCode);
          if (nextResult.type === 'game-over') {
            io.to(roomCode).emit('game-over', { winnerId: nextResult.winner });
          } else {
            processBotTurn(roomCode);
          }
          return;
        }
      }
    }

    if (dice.isDouble) {
      player.doublesCount++;
      if (player.doublesCount >= 3) {
        room.sendToJail(player.id);
        broadcastLog(roomCode, `🤖 ${player.name} melempar 3x double berturut! Masuk penjara!`);
        io.to(roomCode).emit('dice-result', { playerId: player.id, dice });
        broadcastRoomState(roomCode);
        const nextResult = room.nextTurn();
        broadcastRoomState(roomCode);
        processBotTurn(roomCode);
        return;
      }
    }

    const moveResult = room.movePlayer(player.id, dice.total);
    io.to(roomCode).emit('dice-result', { playerId: player.id, dice, moveResult });

    if (moveResult.passedStart) {
      broadcastLog(roomCode, `🤖 ${player.name} melewati START, terima Rp2jt`);
    }

    const space = properties[player.position];
    broadcastLog(roomCode, `🤖 ${player.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);

    // Handle landing
    setTimeout(() => {
      handleLanding(roomCode, player.id, dice.total);

      broadcastRoomState(roomCode);

      // If double, bot gets another turn
      if (dice.isDouble && !player.bankrupt && !player.inJail) {
        setTimeout(() => processBotTurn(roomCode), 1500);
      } else {
        const nextResult = room.nextTurn();
        broadcastRoomState(roomCode);
        if (nextResult.type === 'game-over') {
          io.to(roomCode).emit('game-over', { winnerId: nextResult.winner });
        } else {
          processBotTurn(roomCode);
        }
      }
    }, 1000);
  }, 1500);
}

function handleLanding(roomCode, playerId, diceTotal) {
  const room = rooms.get(roomCode);
  const player = room.players.get(playerId);
  const space = properties[player.position];

  switch (space.type) {
    case 'property':
    case 'airport':
    case 'utility': {
      const state = room.boardState[player.position];
      if (!state.ownerId) {
        // Unowned
        if (player.isBot) {
          const shouldBuy = Bot.decide(player, 'buy-property', { price: space.price });
          if (shouldBuy) {
            room.buyProperty(playerId, player.position);
            broadcastLog(roomCode, `🤖 ${player.name} membeli ${space.name} seharga Rp${space.price}rb`);
          } else {
            broadcastLog(roomCode, `🤖 ${player.name} melewati ${space.name}`);
          }
        } else {
          io.to(roomCode).emit('buy-option', { propertyId: player.position, space });
        }
      } else if (state.ownerId !== playerId) {
        const rent = room.payRent(playerId, player.position, diceTotal);
        if (rent > 0) {
          const owner = room.players.get(state.ownerId);
          broadcastLog(roomCode, `${player.name} membayar sewa Rp${rent}rb ke ${owner.name} untuk ${space.name}`);
          if (player.bankrupt) {
            broadcastLog(roomCode, `💀 ${player.name} bangkrut!`);
            io.to(roomCode).emit('player-bankrupt', { playerId });
          }
        }
      }
      break;
    }
    case 'tax': {
      const amount = space.price;
      player.money -= amount;
      if (player.money < 0) {
        player.money = 0;
        player.bankrupt = true;
        player.properties.forEach(id => {
          room.boardState[id] = { ownerId: null, houses: 0, hotel: false, mortgaged: false };
        });
        player.properties = [];
        broadcastLog(roomCode, `💀 ${player.name} bangkrut karena pajak!`);
        io.to(roomCode).emit('player-bankrupt', { playerId });
      } else {
        broadcastLog(roomCode, `${player.name} membayar ${space.name} Rp${amount}rb`);
      }
      break;
    }
    case 'go-to-jail': {
      room.sendToJail(playerId);
      broadcastLog(roomCode, `🚔 ${player.name} masuk penjara!`);
      break;
    }
    case 'chance':
    case 'community': {
      const card = room.drawCard(space.type);
      io.to(roomCode).emit('card-drawn', { playerId, card, type: space.type });
      broadcastLog(roomCode, `${player.name} mengambil kartu ${space.type === 'chance' ? 'Kesempatan' : 'Dana Umum'}: ${card.text}`);
      executeCard(roomCode, playerId, card, diceTotal);
      break;
    }
  }
}

function executeCard(roomCode, playerId, card, diceTotal) {
  const room = rooms.get(roomCode);
  const player = room.players.get(playerId);

  switch (card.action) {
    case 'move':
      room.movePlayerTo(playerId, card.value);
      handleLanding(roomCode, playerId, diceTotal);
      break;
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
      room.movePlayerTo(playerId, pos);
      handleLanding(roomCode, playerId, diceTotal);
      break;
    }
    case 'collect':
      player.money += card.value;
      break;
    case 'pay':
      player.money -= card.value;
      if (player.money < 0) { player.money = 0; player.bankrupt = true; }
      break;
    case 'jail':
      room.sendToJail(playerId);
      break;
    case 'jail-free':
      player.jailFreeCards++;
      break;
    case 'repair': {
      let cost = 0;
      player.properties.forEach(id => {
        const s = room.boardState[id];
        if (s.hotel) cost += card.value[1];
        else cost += s.houses * card.value[0];
      });
      player.money -= cost;
      if (player.money < 0) { player.money = 0; player.bankrupt = true; }
      broadcastLog(roomCode, `${player.name} membayar biaya renovasi Rp${cost}rb`);
      break;
    }
    case 'collect-each': {
      const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
      others.forEach(p => {
        p.money -= card.value;
        player.money += card.value;
      });
      break;
    }
    case 'pay-each': {
      const others = [...room.players.values()].filter(p => p.id !== playerId && !p.bankrupt);
      others.forEach(p => {
        player.money -= card.value;
        p.money += card.value;
      });
      if (player.money < 0) { player.money = 0; player.bankrupt = true; }
      break;
    }
  }
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Rejoin after page navigation (lobby -> game)
  socket.on('rejoin', ({ roomCode, playerId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    // Update player's socket id
    const player = room.players.get(playerId);
    if (player) {
      room.players.delete(playerId);
      player.id = socket.id;
      player.connected = true;
      room.players.set(socket.id, player);
      // Update turn order
      room.turnOrder = room.turnOrder.map(id => id === playerId ? socket.id : id);
      // Update host
      if (room.hostId === playerId) room.hostId = socket.id;
      // Update board ownership
      for (const [, state] of Object.entries(room.boardState)) {
        if (state.ownerId === playerId) state.ownerId = socket.id;
      }
      // Update player property references
      player.properties = player.properties.map(id => id); // keep as-is, they're tile ids
    }
    playerRooms.set(socket.id, roomCode);
    socket.join(roomCode);
    if (typeof callback === 'function') {
      callback({ newPlayerId: socket.id });
    }
    broadcastRoomState(roomCode);
  });

  socket.on('create-room', ({ name, token }, callback) => {
    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id);
    room.addPlayer(socket.id, name, token);
    rooms.set(code, room);
    playerRooms.set(socket.id, code);
    socket.join(code);
    callback({ success: true, code, playerId: socket.id });
    broadcastRoomState(code);
  });

  socket.on('join-room', ({ code, name, token }, callback) => {
    code = code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return callback({ success: false, error: 'Room tidak ditemukan' });
    if (room.state !== 'lobby') return callback({ success: false, error: 'Game sudah dimulai' });
    if (room.players.size >= 4) return callback({ success: false, error: 'Room penuh' });

    const player = room.addPlayer(socket.id, name, token);
    if (!player) return callback({ success: false, error: 'Token sudah dipakai' });

    playerRooms.set(socket.id, code);
    socket.join(code);
    callback({ success: true, code, playerId: socket.id });
    broadcastLog(code, `${name} bergabung ke room!`);
    broadcastRoomState(code);
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
    if (room.startGame()) {
      broadcastLog(code, '🎮 Game dimulai!');
      broadcastRoomState(code);
      processBotTurn(code);
    }
  });

  socket.on('roll-dice', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;

    const dice = rules.rollDice();

    // Handle jail
    if (current.inJail) {
      if (dice.isDouble) {
        current.inJail = false;
        current.jailTurns = 0;
        broadcastLog(code, `${current.name} melempar double dan keluar penjara!`);
      } else {
        current.jailTurns++;
        if (current.jailTurns >= 3) {
          current.money -= 500;
          current.inJail = false;
          current.jailTurns = 0;
          broadcastLog(code, `${current.name} terpaksa membayar Rp500rb keluar penjara`);
        } else {
          broadcastLog(code, `${current.name} gagal keluar penjara (percobaan ${current.jailTurns}/3)`);
          io.to(code).emit('dice-result', { playerId: current.id, dice, inJail: true });
          broadcastRoomState(code);
          const nextResult = room.nextTurn();
          broadcastRoomState(code);
          if (nextResult.type === 'game-over') {
            io.to(code).emit('game-over', { winnerId: nextResult.winner });
          } else {
            processBotTurn(code);
          }
          return;
        }
      }
    }

    // Check triple doubles
    if (dice.isDouble) {
      current.doublesCount++;
      if (current.doublesCount >= 3) {
        room.sendToJail(current.id);
        broadcastLog(code, `${current.name} melempar 3x double berturut! Masuk penjara!`);
        io.to(code).emit('dice-result', { playerId: current.id, dice });
        broadcastRoomState(code);
        const nextResult = room.nextTurn();
        broadcastRoomState(code);
        processBotTurn(code);
        return;
      }
    }

    const moveResult = room.movePlayer(current.id, dice.total);
    const space = properties[current.position];

    io.to(code).emit('dice-result', { playerId: current.id, dice, moveResult });

    if (moveResult.passedStart) {
      broadcastLog(code, `${current.name} melewati START, terima Rp2jt`);
    }
    broadcastLog(code, `${current.name} melempar ${dice.d1}+${dice.d2}=${dice.total}, mendarat di ${space.name}`);

    handleLanding(code, current.id, dice.total);
    broadcastRoomState(code);

    // If player went bankrupt or was sent to jail, advance turn immediately
    if (current.bankrupt || current.inJail) {
      const nextResult = room.nextTurn();
      broadcastRoomState(code);
      if (nextResult.type === 'game-over') {
        io.to(code).emit('game-over', { winnerId: nextResult.winner });
      } else {
        processBotTurn(code);
      }
    }
  });

  socket.on('buy-property', ({ buy }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;

    if (buy) {
      const space = properties[current.position];
      if (room.buyProperty(socket.id, current.position)) {
        broadcastLog(code, `${current.name} membeli ${space.name} seharga Rp${space.price}rb`);
      }
    } else {
      // Start auction
      const space = properties[current.position];
      broadcastLog(code, `${current.name} melewati ${space.name}, lelang dimulai!`);
      const auction = room.startAuction(current.position);
      io.to(code).emit('auction-start', { propertyId: current.position, space });

      // Handle bot bids in auction
      setTimeout(() => handleBotAuction(code), 1000);
    }
    broadcastRoomState(code);
  });

  socket.on('place-bid', ({ amount }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.auctionState) return;
    if (room.placeBid(socket.id, amount)) {
      const player = room.players.get(socket.id);
      broadcastLog(code, `${player.name} bid Rp${amount}rb`);
      io.to(code).emit('auction-update', room.auctionState);
      setTimeout(() => handleBotAuction(code), 1000);
    }
  });

  socket.on('pass-auction', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || !room.auctionState) return;
    const result = room.passAuction(socket.id);
    if (result) {
      if (result.type === 'auction-end') {
        io.to(code).emit('auction-end', result);
        if (result.winner) {
          const winner = room.players.get(result.winner);
          broadcastLog(code, `${winner.name} memenangkan lelang ${properties[result.propertyId].name} seharga Rp${result.amount}rb`);
        }
      } else if (room.auctionState) {
        io.to(code).emit('auction-update', {
          propertyId: room.auctionState.propertyId,
          currentBid: room.auctionState.currentBid,
          currentBidder: room.auctionState.currentBidder,
          passed: [...room.auctionState.passed]
        });
      }
      broadcastRoomState(code);
    }
  });

  socket.on('build-house', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.buildHouse(socket.id, propertyId)) {
      broadcastLog(code, `${room.players.get(socket.id).name} membangun rumah di ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('build-hotel', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.buildHotel(socket.id, propertyId)) {
      broadcastLog(code, `${room.players.get(socket.id).name} membangun hotel di ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('mortgage', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.mortgageProperty(socket.id, propertyId)) {
      broadcastLog(code, `${room.players.get(socket.id).name} menggadai ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('unmortgage', ({ propertyId }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    if (room.unmortgageProperty(socket.id, propertyId)) {
      broadcastLog(code, `${room.players.get(socket.id).name} menebus ${properties[propertyId].name}`);
      broadcastRoomState(code);
    }
  });

  socket.on('trade-offer', ({ toId, offer }) => {
    const code = playerRooms.get(socket.id);
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
    broadcastLog(code, `${player.name} membayar Rp500rb untuk keluar penjara`);
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
    broadcastLog(code, `${player.name} menggunakan kartu bebas penjara!`);
    broadcastRoomState(code);
  });

  socket.on('chat-message', ({ message }) => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    io.to(code).emit('chat-message', {
      playerId: socket.id,
      name: player.name,
      message,
      timestamp: Date.now()
    });
  });

  socket.on('end-turn', () => {
    const code = playerRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.state !== 'playing') return;
    const current = room.getCurrentPlayer();
    if (!current || current.id !== socket.id) return;
    const nextResult = room.nextTurn();
    broadcastRoomState(code);
    if (nextResult.type === 'game-over') {
      io.to(code).emit('game-over', { winnerId: nextResult.winner });
    } else {
      processBotTurn(code);
    }
  });

  socket.on('disconnect', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.connected = false;
      broadcastLog(code, `${player.name} terputus`);
    }

    if (room.state === 'lobby') {
      const result = room.removePlayer(socket.id);
      playerRooms.delete(socket.id);

      if (result === 'empty') {
        rooms.delete(code);
      } else {
        broadcastRoomState(code);
      }
    } else {
      playerRooms.delete(socket.id);
      broadcastRoomState(code);

      // Clean up room if all human players stay disconnected
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

function handleBotAuction(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.auctionState) return;

  const auction = room.auctionState;
  const space = properties[auction.propertyId];

  for (const botId of auction.participants) {
    const bot = room.players.get(botId);
    if (!bot || !bot.isBot || auction.passed.has(botId)) continue;

    const decision = Bot.decide(bot, 'auction-bid', {
      price: space.price,
      currentBid: auction.currentBid
    });

    if (decision.bid) {
      room.placeBid(botId, decision.amount);
      broadcastLog(roomCode, `🤖 ${bot.name} bid Rp${decision.amount}rb`);
    } else {
      room.passAuction(botId);
      broadcastLog(roomCode, `🤖 ${bot.name} pass lelang`);
    }
  }

  // Check if auction should end
  const remaining = auction.participants.filter(id => !auction.passed.has(id));
  if (remaining.length <= 1 || remaining.every(id => room.players.get(id).isBot)) {
    const result = room.endAuction();
    io.to(roomCode).emit('auction-end', result);
    if (result.winner) {
      const winner = room.players.get(result.winner);
      broadcastLog(roomCode, `${winner.name} memenangkan lelang!`);
    }
    broadcastRoomState(roomCode);
  } else {
    io.to(roomCode).emit('auction-update', {
      propertyId: auction.propertyId,
      currentBid: auction.currentBid,
      currentBidder: auction.currentBidder,
      passed: [...auction.passed]
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎲 Monopoli Nusantara server running at http://localhost:${PORT}`);
});
