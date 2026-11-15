(function (root) {
  const TOPIC_ROOT = 'monopoli-nusantara/v2/rooms';
  const WSS_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ];

  function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'NUS-';
    for (let i = 0; i < 3; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function normalizeRoomCode(raw) {
    const clean = String(raw || '').trim().toUpperCase();
    if (/^[A-Z0-9]{3}$/.test(clean)) return `NUS-${clean}`;
    return clean;
  }

  function connectMqttClient(clientId, will) {
    return new Promise((resolve, reject) => {
      if (typeof root.mqtt === 'undefined' || typeof root.mqtt.connect !== 'function') {
        reject(new Error('Layanan koneksi realtime gagal dimuat. Periksa koneksi internet Anda.'));
        return;
      }

      let idx = 0;
      const tryBroker = () => {
        if (idx >= WSS_BROKERS.length) {
          reject(new Error('Tidak dapat terhubung ke server relay multiplayer. Coba lagi sebentar.'));
          return;
        }
        const url = WSS_BROKERS[idx++];
        let settled = false;
        const client = root.mqtt.connect(url, {
          clientId,
          clean: true,
          connectTimeout: 4500,
          reconnectPeriod: 2000,
          keepalive: 30,
          ...(will ? { will } : {})
        });

        const failTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            try { client.end(true); } catch (_) {}
            tryBroker();
          }
        }, 5000);

        client.on('connect', () => {
          if (!settled) {
            settled = true;
            clearTimeout(failTimer);
            resolve(client);
          }
        });

        client.on('error', () => {
          if (!settled) {
            settled = true;
            clearTimeout(failTimer);
            try { client.end(true); } catch (_) {}
            tryBroker();
          }
        });
      };

      tryBroker();
    });
  }

  function safeParse(payload) {
    try {
      return JSON.parse(typeof payload === 'string' ? payload : payload.toString());
    } catch (_) {
      return null;
    }
  }

  async function createP2PHostRoom({ name, token }) {
    if (typeof root.createLocalMonopolyEngine !== 'function') {
      throw new Error('Engine permainan lokal belum dimuat.');
    }

    const code = generateRoomCode();
    const hostId = `host-${code}`;
    const hostClientId = `mn-host-${code}-${Math.random().toString(36).slice(2, 7)}`;
    const toHostTopic = `${TOPIC_ROOT}/${code}/to-host`;
    const toClientsTopic = `${TOPIC_ROOT}/${code}/to-clients`;

    const client = await connectMqttClient(hostClientId, {
      topic: toClientsTopic,
      payload: JSON.stringify({
        type: 'server-event',
        event: 'game-log',
        payload: { message: '⚠️ Koneksi Host terputus.', timestamp: Date.now() }
      }),
      qos: 0,
      retain: false
    });

    await new Promise((res, rej) => {
      client.subscribe(toHostTopic, { qos: 1 }, (err) => (err ? rej(err) : res()));
    });

    const engine = root.createLocalMonopolyEngine();
    const listeners = new Map();
    const sessionToPlayer = new Map(); // guestSessionId -> playerId

    const dispatchLocal = (event, payload) => {
      const fns = listeners.get(event) || [];
      fns.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error('[P2P Host listener error]', event, e);
        }
      });
    };

    engine.onBroadcast((event, payload) => {
      dispatchLocal(event, payload);
      if (client.connected) {
        client.publish(toClientsTopic, JSON.stringify({ type: 'server-event', event, payload }), { qos: 1 });
      }
    });

    await engine.createLobbyRoom(code, hostId, name, token);

    client.on('message', (topic, raw) => {
      if (topic !== toHostTopic) return;
      const msg = safeParse(raw);
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'join-request' && msg.guestSessionId) {
        let playerId = sessionToPlayer.get(msg.guestSessionId);
        let res;
        if (playerId) {
          res = { success: true, code, playerId };
        } else {
          playerId = `p2p-${Math.random().toString(36).slice(2, 9)}`;
          res = engine.joinLobbyPlayer(playerId, msg.name, msg.token);
          if (res && res.success) {
            sessionToPlayer.set(msg.guestSessionId, playerId);
          }
        }

        const replyTopic = `${TOPIC_ROOT}/${code}/to-client/${msg.guestSessionId}`;
        const initialState = res && res.success ? engine.getStateSnapshot() : null;
        const initialLogs = res && res.success ? engine.getLogs() : [];
        client.publish(replyTopic, JSON.stringify({
          type: 'join-response',
          reqId: msg.reqId,
          response: res,
          initialState,
          initialLogs
        }), { qos: 1 });
      } else if (msg.type === 'client-emit') {
        const senderPlayerId = sessionToPlayer.get(msg.guestSessionId) || msg.playerId;
        if (!senderPlayerId) return;
        engine.handleClientEvent(senderPlayerId, msg.event, msg.payload, (cbRes) => {
          if (msg.guestSessionId && client.connected) {
            const replyTopic = `${TOPIC_ROOT}/${code}/to-client/${msg.guestSessionId}`;
            client.publish(replyTopic, JSON.stringify({
              type: 'emit-ack',
              reqId: msg.reqId,
              response: cbRes
            }), { qos: 1 });
          }
        });
      }
    });

    const hostSocket = {
      isP2P: true,
      role: 'host',
      code,
      playerId: hostId,
      on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(fn);
      },
      emit(event, payload = {}, callback) {
        engine.handleClientEvent(hostId, event, payload, callback);
      },
      getInitialState: () => engine.getStateSnapshot(),
      getLogs: () => engine.getLogs(),
      destroy() {
        try { client.end(true); } catch (_) {}
      }
    };

    return { code, playerId: hostId, socket: hostSocket };
  }

  async function joinP2PGuestRoom({ code, name, token }) {
    const cleanCode = normalizeRoomCode(code);
    if (!cleanCode) {
      throw new Error('Masukkan kode room terlebih dahulu!');
    }

    const guestSessionId = `g-${Math.random().toString(36).slice(2, 10)}`;
    const guestClientId = `mn-guest-${cleanCode}-${Math.random().toString(36).slice(2, 7)}`;
    const toHostTopic = `${TOPIC_ROOT}/${cleanCode}/to-host`;
    const toClientsTopic = `${TOPIC_ROOT}/${cleanCode}/to-clients`;
    const directTopic = `${TOPIC_ROOT}/${cleanCode}/to-client/${guestSessionId}`;

    const client = await connectMqttClient(guestClientId);

    await new Promise((res, rej) => {
      client.subscribe([toClientsTopic, directTopic], { qos: 1 }, (err) => (err ? rej(err) : res()));
    });

    let myPlayerId = null;
    let latestState = null;
    const bufferedLogs = [];
    const seenLogKeys = new Set();
    const listeners = new Map();
    const pendingAcks = new Map();
    let reqCounter = 1;

    const recordLog = (entry) => {
      if (!entry || !entry.message) return false;
      const key = `${entry.timestamp || ''}|${entry.message}`;
      if (seenLogKeys.has(key)) return false;
      seenLogKeys.add(key);
      bufferedLogs.push(entry);
      if (bufferedLogs.length > 60) bufferedLogs.shift();
      return true;
    };

    const dispatch = (event, payload) => {
      if (event === 'room-state') latestState = payload;
      if (event === 'game-log') {
        if (!recordLog(payload)) return;
      }
      const fns = listeners.get(event) || [];
      fns.forEach(fn => {
        try {
          fn(payload);
        } catch (e) {
          console.error('[P2P Guest listener error]', event, e);
        }
      });
    };

    client.on('message', (topic, raw) => {
      if (topic !== toClientsTopic && topic !== directTopic) return;
      const msg = safeParse(raw);
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'join-response') {
        if (msg.initialState) {
          latestState = msg.initialState;
        }
        if (Array.isArray(msg.initialLogs)) {
          msg.initialLogs.forEach(recordLog);
        }
        const cb = pendingAcks.get(msg.reqId);
        if (cb) {
          pendingAcks.delete(msg.reqId);
          cb(msg.response);
        }
      } else if (msg.type === 'emit-ack') {
        const cb = pendingAcks.get(msg.reqId);
        if (cb) {
          pendingAcks.delete(msg.reqId);
          cb(msg.response);
        }
      } else if (msg.type === 'server-event') {
        dispatch(msg.event, msg.payload);
      }
    });

    const joinRes = await new Promise((resolve, reject) => {
      const reqId = reqCounter++;
      let done = false;

      const sendReq = () => {
        if (done) return;
        client.publish(toHostTopic, JSON.stringify({
          type: 'join-request',
          guestSessionId,
          reqId,
          name,
          token
        }), { qos: 1 });
      };

      const retryTimer = setTimeout(sendReq, 2200);
      const timeoutTimer = setTimeout(() => {
        if (!done) {
          done = true;
          clearTimeout(retryTimer);
          pendingAcks.delete(reqId);
          try { client.end(true); } catch (_) {}
          reject(new Error(`Room "${cleanCode}" tidak ditemukan atau Host belum membuka lobby.`));
        }
      }, 6500);

      pendingAcks.set(reqId, (res) => {
        if (!done) {
          done = true;
          clearTimeout(retryTimer);
          clearTimeout(timeoutTimer);
          if (res && res.success) {
            resolve(res);
          } else {
            try { client.end(true); } catch (_) {}
            reject(new Error((res && res.error) || 'Gagal bergabung ke room'));
          }
        }
      });

      sendReq();
    });

    myPlayerId = joinRes.playerId;

    const guestSocket = {
      isP2P: true,
      role: 'guest',
      code: joinRes.code,
      playerId: myPlayerId,
      on(event, fn) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(fn);
      },
      emit(event, payload = {}, callback) {
        if (event === 'rejoin') {
          if (typeof callback === 'function') {
            callback({ newPlayerId: myPlayerId, logs: [...bufferedLogs] });
          }
          if (latestState) dispatch('room-state', latestState);
          return;
        }
        if (!client.connected) return;
        const ackId = reqCounter++;
        if (typeof callback === 'function') {
          pendingAcks.set(ackId, callback);
        }
        client.publish(toHostTopic, JSON.stringify({
          type: 'client-emit',
          guestSessionId,
          playerId: myPlayerId,
          reqId: ackId,
          event,
          payload
        }), { qos: 1 });
      },
      getInitialState: () => latestState,
      getLogs: () => [...bufferedLogs],
      destroy() {
        try { client.end(true); } catch (_) {}
      }
    };

    return { response: joinRes, socket: guestSocket };
  }

  root.P2PNetwork = {
    normalizeRoomCode,
    createP2PHostRoom,
    joinP2PGuestRoom
  };
})(typeof window !== 'undefined' ? window : globalThis);
