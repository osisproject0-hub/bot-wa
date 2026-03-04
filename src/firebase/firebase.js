// Firebase utilities
const { getFirestore } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');

const db = getFirestore();
const rtdb = getDatabase();

async function getUser(userId) {
  const doc = await db.collection('users').doc(userId).get();
  return doc.exists ? doc.data() : null;
}

async function updateUser(userId, data) {
  await db.collection('users').doc(userId).update(data);
}

async function getActivePair(userId) {
  const snapshot = await db.collection('active_pairs').where('user1', '==', userId).get();
  if (!snapshot.empty) return snapshot.docs[0].data();
  const snapshot2 = await db.collection('active_pairs').where('user2', '==', userId).get();
  if (!snapshot2.empty) return snapshot2.docs[0].data();
  return null;
}

async function createPair(pair) {
  await db.collection('active_pairs').doc(pair.id).set(pair);
}

async function deletePair(pairId) {
  await db.collection('active_pairs').doc(pairId).delete();
}

module.exports = { db, rtdb, getUser, updateUser, getActivePair, createPair, deletePair };