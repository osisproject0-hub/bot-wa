require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');
const redis = require('redis');
const { startBot } = require('./bot/bot');
const { setupMatchmaking } = require('./matchmaking/matchmaking');
const { setupServices } = require('./services/services');
const { setupMiddleware } = require('./middleware/middleware');
const { setupCommands } = require('./commands/commands');

// Initialize Firebase
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};
initializeApp({
  credential: require('firebase-admin').credential.cert(firebaseConfig),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com/`
});

const db = getFirestore();
const rtdb = getDatabase();

// Initialize Redis
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});
redisClient.connect();

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup middleware
setupMiddleware(app, logger);

// Setup services
setupServices(app, db, rtdb, redisClient, logger);

// Start bot
startBot(db, rtdb, redisClient, logger);

// Setup matchmaking
setupMatchmaking(db, rtdb, redisClient, logger);

// Setup commands
setupCommands(db, rtdb, redisClient, logger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Admin API
app.get('/admin/stats', async (req, res) => {
  try {
    // Implement admin stats
    const stats = {
      activeUsers: 0, // fetch from DB
      activeChats: 0,
      totalReports: 0,
    };
    res.json(stats);
  } catch (error) {
    logger.error('Admin stats error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  redisClient.quit();
  process.exit(0);
});