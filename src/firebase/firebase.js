// Supabase utilities
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function updateUser(userId, data) {
  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, ...data });

  if (error) throw error;
}

async function getActivePair(userId) {
  const { data, error } = await supabase
    .from('active_pairs')
    .select('*')
    .or(`user1.eq.${userId},user2.eq.${userId}`)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function createPair(pair) {
  const { error } = await supabase
    .from('active_pairs')
    .insert(pair);

  if (error) throw error;
}

async function deletePair(pairId) {
  const { error } = await supabase
    .from('active_pairs')
    .delete()
    .eq('id', pairId);

  if (error) throw error;
}

async function getUsersCount() {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

async function getActivePairsCount() {
  const { count, error } = await supabase
    .from('active_pairs')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

async function getReportsCount() {
  const { count, error } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count || 0;
}

module.exports = {
  supabase,
  getUser,
  updateUser,
  getActivePair,
  createPair,
  deletePair,
  getUsersCount,
  getActivePairsCount,
  getReportsCount
};