/**
 * Budget Service
 * จัดการงบประมาณประจำเดือน (Overall Budget และ Category Budget)
 * คำนวณและแจ้งเตือนเมื่อใช้จ่ายใกล้หรือเกินงบประมาณ
 */

const { supabase } = require('./supabaseClient');

function getCurrentMonthYear() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
}

async function setBudget(userId, amount, category = null) {
  if (!userId) return { success: false, error: 'User ID is required' };
  const monthYear = getCurrentMonthYear();

  try {
    const payload = {
      line_user_id: userId,
      amount: Number(amount),
      category: category || null,
      month_year: monthYear,
    };

    // เช็คว่ามีงบเดือนนี้อยู่แล้วหรือไม่
    let query = supabase.from('budgets').select('*').eq('line_user_id', userId).eq('month_year', monthYear);
    if (category) {
      query = query.eq('category', category);
    } else {
      query = query.is('category', null);
    }

    const { data: existing } = await query;

    let result;
    if (existing && existing.length > 0) {
      result = await supabase
        .from('budgets')
        .update({ amount: Number(amount) })
        .eq('id', existing[0].id)
        .select();
    } else {
      result = await supabase.from('budgets').insert([payload]).select();
    }

    if (result.error) {
      console.error('❌ Supabase budget error:', result.error.message);
      return { success: false, error: result.error.message };
    }

    return { success: true, budget: result.data[0] };
  } catch (err) {
    console.error('❌ Budget Error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getBudgets(userId) {
  if (!userId) return [];
  const monthYear = getCurrentMonthYear();

  try {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('line_user_id', userId)
      .eq('month_year', monthYear);

    if (error) {
      console.error('❌ Fetch budgets error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    return [];
  }
}

/**
  * ตรวจสอบว่าค่าใช้จ่ายในเดือนนี้ใกล้เกินงบหรือยัง
  * @param {string} userId
  * @param {Array} currentMonthExpenses - รายการรายจ่ายในเดือนนี้
  * @returns {string|null} ข้อความแจ้งเตือน หรือ null ถ้าไม่เกิน
  */
async function checkBudgetWarning(userId, currentMonthExpenses) {
  if (!userId) return null;
  const budgets = await getBudgets(userId);
  if (budgets.length === 0) return null;

  const totalExpense = (currentMonthExpenses || [])
    .filter((r) => r.type === 'รายจ่าย')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const overallBudget = budgets.find((b) => !b.category);

  if (!overallBudget) return null;

  const limit = Number(overallBudget.amount);
  const pct = (totalExpense / limit) * 100;

  if (pct >= 100) {
    return `\n⚠️ ALERT: เดือนนี้คุณใช้จ่ายไป ${totalExpense.toLocaleString()} / ${limit.toLocaleString()} ฿ (เกินงบแล้ว 100%! 🚨)`;
  }
  if (pct >= 80) {
    return `\n⚠️ เตือน: เดือนนี้ใช้จ่ายไป ${totalExpense.toLocaleString()} / ${limit.toLocaleString()} ฿ (คิดเป็น ${pct.toFixed(0)}% ของงบที่ตั้งไว้)`;
  }

  return null;
}

module.exports = {
  checkBudgetWarning,
  getBudgets,
  setBudget,
};
