const crypto = require('crypto');

function generateAnonymousId() {
  return crypto.randomBytes(16).toString('hex');
}

function sanitizeInput(input) {
  // Basic sanitization
  return input.replace(/[<>\"'&]/g, '');
}

function isValidPhone(phone) {
  // Basic validation
  return /^\d{10,15}@c\.us$/.test(phone);
}

function rateLimitCheck(userId, redisClient) {
  // Implement rate limiting: max 10 messages per minute
  const key = `rate_limit:${userId}`;
  return redisClient.incr(key).then(count => {
    if (count === 1) {
      redisClient.expire(key, 60); // 1 minute
    }
    return count <= 10;
  });
}

function detectSpam(message) {
  // Simple spam detection
  const spamPatterns = [/(.)\1{10,}/, /https?:\/\//i]; // Repeated chars, URLs
  return spamPatterns.some(pattern => pattern.test(message));
}

function floodControl(userId, redisClient) {
  // Check for flood: max 5 messages in 10 seconds
  const key = `flood:${userId}`;
  return redisClient.incr(key).then(count => {
    if (count === 1) {
      redisClient.expire(key, 10);
    }
    return count <= 5;
  });
}

module.exports = { generateAnonymousId, sanitizeInput, isValidPhone, rateLimitCheck };