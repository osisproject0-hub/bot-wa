const { v4: uuidv4 } = require('uuid');

async function setupMatchmaking(db, rtdb, redisClient, logger) {
  // Run matchmaking loop
  setInterval(async () => {
    await performMatchmaking(db, rtdb, redisClient, logger);
  }, 5000); // Check every 5 seconds
}

async function performMatchmaking(db, rtdb, redisClient, logger) {
  try {
    const waitingUsers = await redisClient.lRange('waiting_queue', 0, -1);
    if (waitingUsers.length < 2) return;

    // Get user preferences
    const usersWithPrefs = await Promise.all(
      waitingUsers.map(async (userId) => {
        const userDoc = await db.collection('users').doc(userId).get();
        return { id: userId, prefs: userDoc.data()?.preferences || {} };
      })
    );

    // Simple matching: find compatible pairs
    for (let i = 0; i < usersWithPrefs.length - 1; i++) {
      for (let j = i + 1; j < usersWithPrefs.length; j++) {
        const user1 = usersWithPrefs[i];
        const user2 = usersWithPrefs[j];

        if (isCompatible(user1.prefs, user2.prefs)) {
          // Remove from queue
          await redisClient.lRem('waiting_queue', 0, user1.id);
          await redisClient.lRem('waiting_queue', 0, user2.id);

          // Create pair
          const pairId = uuidv4();
          await db.collection('active_pairs').doc(pairId).set({
            id: pairId,
            user1: user1.id,
            user2: user2.id,
            startedAt: new Date(),
          });

          // Update user statuses
          await db.collection('users').doc(user1.id).update({ status: 'chatting', pairId });
          await db.collection('users').doc(user2.id).update({ status: 'chatting', pairId });

          logger.info(`Paired ${user1.id} with ${user2.id}`);
          return; // Pair one at a time
        }
      }
    }
  } catch (error) {
    logger.error('Matchmaking error', error);
  }
}

function isCompatible(prefs1, prefs2) {
  // Basic compatibility check
  if (prefs1.gender && prefs2.gender) {
    if (prefs1.preferredGender && prefs1.preferredGender !== prefs2.gender) return false;
    if (prefs2.preferredGender && prefs2.preferredGender !== prefs1.gender) return false;
  }
  if (prefs1.language && prefs2.language && prefs1.language !== prefs2.language) return false;
  return true;
}

async function findMatch(userId, preferences, db, rtdb, redisClient, logger) {
  // Advanced matching logic here
  // For now, simple random
  const waitingUsers = await redisClient.lRange('waiting_queue', 0, -1);
  const filtered = waitingUsers.filter(u => u !== userId);
  if (filtered.length > 0) {
    return filtered[0];
  }
  return null;
}

module.exports = { setupMatchmaking, performMatchmaking, findMatch };