const { createClient } = require('@supabase/supabase-js');
const { config } = require('../config');

const supabase = createClient(config.supabase.url, config.supabase.anonKey);

async function createGoal(userId, name, targetAmount, durationMonths) {
  const monthlyAmount = targetAmount / durationMonths;
  const { data, error } = await supabase
    .from('goals')
    .insert([{
      user_id: userId,
      name,
      target_amount: targetAmount,
      duration_months: durationMonths,
      monthly_amount: monthlyAmount,
      current_amount: 0,
      status: 'active'
    }])
    .select();

  if (error) {
    console.error('❌ Supabase insert goal error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, goal: data[0] };
}

async function getGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Supabase fetch goals error:', error);
    return null;
  }
  return data;
}

async function getGoalById(goalId) {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .single();
    
  if (error) return null;
  return data;
}

async function addSavingsToGoal(goalId, amountToAdd) {
  const goal = await getGoalById(goalId);
  if (!goal) return { success: false, error: 'Goal not found' };

  const newAmount = Number(goal.current_amount) + Number(amountToAdd);
  const status = newAmount >= Number(goal.target_amount) ? 'completed' : 'active';

  const { data, error } = await supabase
    .from('goals')
    .update({ 
      current_amount: newAmount,
      status: status
    })
    .eq('id', goalId)
    .select();

  if (error) {
    console.error('❌ Supabase update goal error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, goal: data[0] };
}

async function cancelGoal(goalId) {
  const { data, error } = await supabase
    .from('goals')
    .update({ status: 'cancelled' })
    .eq('id', goalId)
    .select();

  if (error) {
    console.error('❌ Supabase cancel goal error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, goal: data[0] };
}

module.exports = {
  createGoal,
  getGoals,
  getGoalById,
  addSavingsToGoal,
  cancelGoal,
};
