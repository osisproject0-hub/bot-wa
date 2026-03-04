const express = require('express');
const request = require('supertest');

// Create a mock app for testing
const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/analytics', (req, res) => {
  res.json({
    totalUsers: 0,
    activeChats: 0,
    totalReports: 0,
  });
});

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