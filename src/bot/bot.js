const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');

async function startBot(db, rtdb, redisClient, logger) {
  const sessionPath = path.join(__dirname, '../../session');
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: logger,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;
      if (shouldReconnect) {
        logger.info('Reconnecting...');
        startBot(db, rtdb, redisClient, logger);
      } else {
        logger.error('Connection closed. Not reconnecting.');
      }
    } else if (connection === 'open') {
      logger.info('WhatsApp connected!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.key.fromMe && m.type === 'notify') {
      // Update last activity
      await redisClient.set(`last_activity:${msg.key.remoteJid}`, Date.now(), 'EX', 300); // 5 min
      await handleMessage(sock, msg, db, rtdb, redisClient, logger);
    }
  });

  // Clean abandoned chats
  setInterval(async () => {
    const keys = await redisClient.keys('last_activity:*');
    for (const key of keys) {
      const lastActivity = await redisClient.get(key);
      if (Date.now() - lastActivity > 10 * 60 * 1000) { // 10 min
        const userId = key.split(':')[1];
        await disconnectPair(userId, db, rtdb, redisClient, logger);
        await redisClient.del(key);
      }
    }
  }, 60000); // Check every minute

  return sock;
}

const { rateLimitCheck, detectSpam, floodControl, sanitizeInput } = require('../utils/utils');

async function handleMessage(sock, msg, db, rtdb, redisClient, logger) {
  const from = msg.key.remoteJid;
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

  // Anti-abuse checks
  if (!(await rateLimitCheck(from, redisClient))) {
    await sock.sendMessage(from, { text: 'Rate limit exceeded. Please wait.' });
    return;
  }

  if (await floodControl(from, redisClient)) {
    await sock.sendMessage(from, { text: 'Flood detected. Slow down.' });
    return;
  }

  if (detectSpam(body)) {
    await sock.sendMessage(from, { text: 'Spam detected. Message blocked.' });
    return;
  }

  const sanitizedBody = sanitizeInput(body);

  if (!sanitizedBody.startsWith('/')) {
    // Handle regular messages - relay to partner
    await relayMessage(sock, msg, db, rtdb, redisClient, logger);
    return;
  }

  // Handle commands
  const command = body.split(' ')[0].toLowerCase();
  switch (command) {
    case '/start':
      await handleStart(sock, from, db, rtdb, redisClient, logger);
      break;
    case '/next':
      await handleNext(sock, from, db, rtdb, redisClient, logger);
      break;
    case '/stop':
      await handleStop(sock, from, db, rtdb, redisClient, logger);
      break;
    case '/report':
      await handleReport(sock, from, body, db, rtdb, redisClient, logger);
      break;
    case '/profile':
      await handleProfile(sock, from, body, db, rtdb, redisClient, logger);
      break;
    default:
      await sock.sendMessage(from, { text: 'Unknown command. Use /start, /next, /stop, /report, or /profile.' });
  }
}

async function handleStart(sock, from, db, rtdb, redisClient, logger) {
  // Add to waiting queue
  const userRef = db.collection('users').doc(from);
  await userRef.set({
    id: from,
    status: 'waiting',
    joinedAt: new Date(),
  }, { merge: true });

  // Add to matchmaking queue
  await redisClient.lPush('waiting_queue', from);

  await sock.sendMessage(from, { text: 'Looking for a partner... Please wait.' });

  // Trigger matchmaking
  // This could be done in a separate service
}

async function handleNext(sock, from, db, rtdb, redisClient, logger) {
  // Skip current partner, find new one
  // Disconnect current pair, add back to queue
  await disconnectPair(from, db, rtdb, redisClient, logger);
  await handleStart(sock, from, db, rtdb, redisClient, logger);
}

async function handleStop(sock, from, db, rtdb, redisClient, logger) {
  await disconnectPair(from, db, rtdb, redisClient, logger);
  await sock.sendMessage(from, { text: 'Chat ended. Use /start to find a new partner.' });
}

async function handleReport(sock, from, body, db, rtdb, redisClient, logger) {
  const reason = body.replace('/report', '').trim();
  await db.collection('reports').add({
    reporter: from,
    reason: reason,
    timestamp: new Date(),
  });
  await sock.sendMessage(from, { text: 'Report submitted. Thank you for helping keep the community safe.' });
}

async function handleProfile(sock, from, body, db, rtdb, redisClient, logger) {
  // Optional profile setup
  await sock.sendMessage(from, { text: 'Profile feature coming soon.' });
}

async function relayMessage(sock, msg, db, rtdb, redisClient, logger) {
  const from = msg.key.remoteJid;
  const pair = await findPair(from, db, rtdb, redisClient);
  if (!pair) return;

  const partner = pair.user1 === from ? pair.user2 : pair.user1;

  // Relay different message types
  if (msg.message.conversation) {
    await sock.sendMessage(partner, { text: msg.message.conversation });
  } else if (msg.message.imageMessage) {
    const { imageMessage } = msg.message;
    await sock.sendMessage(partner, {
      image: { url: imageMessage.url },
      caption: imageMessage.caption || ''
    });
  } else if (msg.message.audioMessage) {
    await sock.sendMessage(partner, {
      audio: { url: msg.message.audioMessage.url },
      mimetype: 'audio/mp4'
    });
  } else if (msg.message.videoMessage) {
    await sock.sendMessage(partner, {
      video: { url: msg.message.videoMessage.url },
      caption: msg.message.videoMessage.caption || ''
    });
  } else if (msg.message.stickerMessage) {
    await sock.sendMessage(partner, {
      sticker: { url: msg.message.stickerMessage.url }
    });
  }
}

async function findPair(userId, db, rtdb, redisClient) {
  // Query active_pairs
  const pairsRef = db.collection('active_pairs');
  const snapshot = await pairsRef.where('user1', '==', userId).get();
  if (!snapshot.empty) {
    return snapshot.docs[0].data();
  }
  const snapshot2 = await pairsRef.where('user2', '==', userId).get();
  if (!snapshot2.empty) {
    return snapshot2.docs[0].data();
  }
  return null;
}

async function disconnectPair(userId, db, rtdb, redisClient, logger) {
  // Remove from active_pairs
  const pairsRef = db.collection('active_pairs');
  const snapshot = await pairsRef.where('user1', '==', userId).get();
  if (!snapshot.empty) {
    await snapshot.docs[0].ref.delete();
  } else {
    const snapshot2 = await pairsRef.where('user2', '==', userId).get();
    if (!snapshot2.empty) {
      await snapshot2.docs[0].ref.delete();
    }
  }
  // Update user status
  await db.collection('users').doc(userId).update({ status: 'idle' });
}

module.exports = { startBot };