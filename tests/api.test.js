const request = require('supertest');

// Mock Firebase and Redis
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn(),
  },
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    quit: jest.fn(),
  })),
}));

jest.mock('../src/bot/bot', () => ({
  startBot: jest.fn(),
}));

jest.mock('../src/matchmaking/matchmaking', () => ({
  setupMatchmaking: jest.fn(),
}));

jest.mock('../src/services/services', () => ({
  setupServices: jest.fn(),
}));

jest.mock('../src/middleware/middleware', () => ({
  setupMiddleware: jest.fn(),
}));

jest.mock('../src/commands/commands', () => ({
  setupCommands: jest.fn(),
}));

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn(),
  },
}));

const app = require('../src/index');

describe('API Tests', () => {
  it('should return health check', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('OK');
  });

  it('should return analytics', async () => {
    const res = await request(app).get('/api/analytics');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totalUsers');
  });
});