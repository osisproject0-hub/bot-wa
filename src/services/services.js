const { getUsersCount, getActivePairsCount, getReportsCount } = require('../supabase');

function setupServices(app, db, rtdb, redisClient, logger) {
  // Analytics service
  app.get('/api/analytics', async (req, res) => {
    try {
      const [totalUsers, activeChats, totalReports] = await Promise.all([
        getUsersCount(),
        getActivePairsCount(),
        getReportsCount()
      ]);

      res.json({
        totalUsers,
        activeChats,
        totalReports,
      });
    } catch (error) {
      logger.error('Analytics error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Moderation service
  app.post('/api/moderate', async (req, res) => {
    const { userId, action } = req.body;
    // Implement moderation logic
    res.json({ status: 'Moderation action taken' });
  });
}

module.exports = { setupServices };