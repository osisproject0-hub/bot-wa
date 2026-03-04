const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const path = require('path');
const fs = require('fs');
const { supabase, getUser, updateUser, getActivePair, createPair, deletePair } = require('../supabase');
const { detectSpam, floodControl, sanitizeInput } = require('../utils/utils');

async function startBot(db, rtdb, redisClient, logger) {
  const sessionPath = path.join(__dirname, '../../session');
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    // logger: console, // Remove logger to avoid compatibility issues
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      // Display QR code for authentication
      console.log('QR Code received, scan with WhatsApp:');
      console.log(qr);
      logger.info('QR Code generated for WhatsApp authentication');
    }
    
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
      await handleMessage(sock, msg, logger);
    }
  });

  return sock;
}

async function handleMessage(sock, msg, logger) {
  const from = msg.key.remoteJid;
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

  // Anti-abuse checks
  if (await floodControl(from, null)) {
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
    await relayMessage(sock, msg, logger);
    return;
  }

  // Handle commands
  const command = sanitizedBody.split(' ')[0].toLowerCase();
  switch (command) {
    case '/start':
      await handleStart(sock, from, logger);
      break;
    case '/next':
      await handleNext(sock, from, logger);
      break;
    case '/stop':
      await handleStop(sock, from, logger);
      break;
    case '/report':
      await handleReport(sock, from, sanitizedBody, logger);
      break;
    case '/profile':
      await handleProfile(sock, from, sanitizedBody, logger);
      break;
    default:
      await sock.sendMessage(from, { text: 'Unknown command. Use /start, /next, /stop, /report, or /profile.' });
  }
}

async function handleStart(sock, from, logger) {
  try {
    // Add to waiting queue
    await updateUser(from, {
      status: 'waiting',
      joined_at: new Date().toISOString()
    });

    await sock.sendMessage(from, { text: 'Looking for a partner... Please wait.' });
    logger.info(`User ${from} started looking for partner`);
  } catch (error) {
    logger.error('Error in handleStart:', error);
    await sock.sendMessage(from, { text: 'Error occurred. Please try again.' });
  }
}

async function handleNext(sock, from, logger) {
  try {
    // Skip current partner, find new one
    await disconnectPair(from, logger);
    await handleStart(sock, from, logger);
  } catch (error) {
    logger.error('Error in handleNext:', error);
  }
}

async function handleStop(sock, from, logger) {
  try {
    await disconnectPair(from, logger);
    await sock.sendMessage(from, { text: 'Chat ended. Use /start to find a new partner.' });
    logger.info(`User ${from} stopped chat`);
  } catch (error) {
    logger.error('Error in handleStop:', error);
  }
}

async function handleReport(sock, from, body, logger) {
  try {
    const reason = body.replace('/report', '').trim();
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: from,
        reason: reason,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    await sock.sendMessage(from, { text: 'Report submitted. Thank you for helping keep the community safe.' });
    logger.info(`User ${from} submitted report`);
  } catch (error) {
    logger.error('Error in handleReport:', error);
  }
}

async function handleProfile(sock, from, body, logger) {
  // Optional profile setup
  await sock.sendMessage(from, { text: 'Profile feature coming soon.' });
}

async function relayMessage(sock, msg, logger) {
  try {
    const from = msg.key.remoteJid;
    const pair = await getActivePair(from);
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
  } catch (error) {
    logger.error('Error in relayMessage:', error);
  }
}

async function disconnectPair(userId, logger) {
  try {
    const pair = await getActivePair(userId);
    if (pair) {
      await deletePair(pair.id);
      // Update user statuses
      await updateUser(pair.user1, { status: 'idle', current_pair_id: null });
      await updateUser(pair.user2, { status: 'idle', current_pair_id: null });
      logger.info(`Disconnected pair ${pair.id}`);
    }
  } catch (error) {
    logger.error('Error in disconnectPair:', error);
  }
}

module.exports = { startBot };