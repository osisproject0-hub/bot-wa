require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const redis = require('redis');
const { startBot } = require('./bot/bot');
const { setupMatchmaking } = require('./matchmaking/matchmaking');
const { setupServices } = require('./services/services');
const { setupMiddleware } = require('./middleware/middleware');
const { setupCommands } = require('./commands/commands');
const { supabase } = require('./firebase/firebase');

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

// Add trace method for Baileys compatibility
logger.trace = logger.debug;

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Initialize Supabase (already done in firebase.js)
logger.info('Supabase initialized');

// Initialize Redis
let redisClient;
try {
  redisClient = redis.createClient({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
  });
  redisClient.connect();
  logger.info('Redis connected');
} catch (error) {
  logger.warn('Redis connection failed, running without caching:', error.message);
  redisClient = null;
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
setupServices(app, supabase, redisClient, logger);

// Start bot
startBot(supabase, null, redisClient, logger);

// Setup matchmaking
setupMatchmaking(supabase, null, redisClient, logger);

// Setup commands
setupCommands(supabase, null, redisClient, logger);

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