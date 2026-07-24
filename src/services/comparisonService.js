/**
 * Comparison Service
 * เปรียบเทียบรายรับ/รายจ่ายระหว่างเดือนนี้กับเดือนก่อน
 */
const { supabase } = require('./supabaseClient');
const { config } = require('../config');

const TABLE = config.supabase.table;

/**
 * ดึงข้อมูล transactions ในช่วงวันที่ที่กำหนด
 * @param {string|null} lineUserId
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo   - YYYY-MM-DD
 * @returns {Array|null}
 */
async function getMonthlyData(lineUserId, dateFrom, dateTo) {
  try {
    let query = supabase
      .from(TABLE)
      .select('item, amount, category, type, date')
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true });

    if (lineUserId) {
      query = query.eq('line_user_id', lineUserId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('❌ [comparisonService] Supabase Error:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('❌ [comparisonService] Error:', err.message);
    return null;
  }
}

/**
 * คำนวณ % การเปลี่ยนแปลง
 * @param {number} current  - ค่าเดือนนี้
 * @param {number} previous - ค่าเดือนก่อน
 * @returns {{ percent?: number, isNew?: boolean, noChange?: boolean }}
 */
function calcPercentChange(current, previous) {
  if (previous === 0 && current === 0) return { noChange: true };
  if (previous === 0 && current > 0) return { isNew: true };
  const percent = ((current - previous) / previous) * 100;
  return { percent: parseFloat(percent.toFixed(1)) };
}

/**
 * จัดกลุ่มตามหมวดหมู่และรวม amount
 * @param {Array} rows
 * @returns {Object} { [category]: totalAmount }
 */
function groupByCategory(rows) {
  return rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + Number(row.amount);
    return acc;
  }, {});
}

/**
 * รวม amount ทั้งหมด
 * @param {Array} rows
 * @returns {number}
 */
function sumAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

/**
 * สร้าง date string รูปแบบ YYYY-MM-DD
 */
function fmt(year, month, day) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * เปรียบเทียบเดือนนี้กับเดือนก่อน
 * ใช้ Fair Comparison: เทียบถึงวันที่เท่ากันในทั้งสองเดือน
 * @param {string|null} lineUserId
 * @returns {Object|null} comparison data
 */
async function compareMonths(lineUserId) {
  // ใช้เวลาไทย (UTC+7)
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const currentDay = now.getUTCDate();
  const currentMonth = now.getUTCMonth() + 1; // 1-based
  const currentYear = now.getUTCFullYear();

  // ─── เดือนก่อน ────────────────────────────────────────
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // สิ้นเดือนของเดือนก่อน (เพื่อเช็คว่า currentDay เกินสิ้นเดือนก่อนไหม)
  const lastDayOfPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
  // ถ้า currentDay เกินจำนวนวันในเดือนก่อน ให้ใช้วันสุดท้ายของเดือนก่อนแทน
  const compareDayPrev = Math.min(currentDay, lastDayOfPrevMonth);

  // ─── กำหนด date ranges ────────────────────────────────
  const thisMonthFrom = fmt(currentYear, currentMonth, 1);
  const thisMonthTo = fmt(currentYear, currentMonth, currentDay);

  const lastMonthFrom = fmt(prevYear, prevMonth, 1);
  const lastMonthTo = fmt(prevYear, prevMonth, compareDayPrev);

  // ─── ตรวจสอบว่าเป็น full month หรือ partial month ────
  const lastDayOfCurrentMonth = new Date(currentYear, currentMonth, 0).getDate();
  const isPartialMonth = currentDay < lastDayOfCurrentMonth;

  console.log(`📊 [compareMonths] เดือนนี้: ${thisMonthFrom} → ${thisMonthTo}`);
  console.log(`📊 [compareMonths] เดือนก่อน: ${lastMonthFrom} → ${lastMonthTo}`);
  console.log(`📊 [compareMonths] fairMode: ${isPartialMonth}`);

  // ─── ดึงข้อมูลทั้งสองเดือน ────────────────────────────
  const [thisMonthRows, lastMonthRows] = await Promise.all([
    getMonthlyData(lineUserId, thisMonthFrom, thisMonthTo),
    getMonthlyData(lineUserId, lastMonthFrom, lastMonthTo),
  ]);

  if (thisMonthRows === null || lastMonthRows === null) return null;

  // ─── แยก income / expense ─────────────────────────────
  const thisExpense = thisMonthRows.filter((r) => r.type === 'รายจ่าย');
  const thisIncome  = thisMonthRows.filter((r) => r.type === 'รายรับ');
  const lastExpense = lastMonthRows.filter((r) => r.type === 'รายจ่าย');
  const lastIncome  = lastMonthRows.filter((r) => r.type === 'รายรับ');

  const thisExpenseTotal = sumAmount(thisExpense);
  const thisIncomeTotal  = sumAmount(thisIncome);
  const lastExpenseTotal = sumAmount(lastExpense);
  const lastIncomeTotal  = sumAmount(lastIncome);

  // ─── หมวดหมู่รายจ่าย ──────────────────────────────────
  const thisCatExpense = groupByCategory(thisExpense);
  const lastCatExpense = groupByCategory(lastExpense);

  // รวม categories ทั้งสองเดือน (union)
  const allCategories = [
    ...new Set([
      ...Object.keys(thisCatExpense),
      ...Object.keys(lastCatExpense),
    ]),
  ];

  const categoryComparisons = allCategories
    .map((cat) => {
      const current  = thisCatExpense[cat] || 0;
      const previous = lastCatExpense[cat] || 0;
      // ข้ามหมวดที่ทั้งสองเดือน = 0
      if (current === 0 && previous === 0) return null;
      return {
        category: cat,
        current,
        previous,
        diff: current - previous,
        change: calcPercentChange(current, previous),
      };
    })
    .filter(Boolean)
    // เรียงตาม |diff| มากสุดก่อน
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // ─── หมวดที่เพิ่มขึ้นมากสุด ───────────────────────────
  const topIncreased = categoryComparisons
    .filter((c) => c.diff > 0)
    .sort((a, b) => b.diff - a.diff)[0] || null;

  return {
    thisMonth: {
      label: getThaiMonthLabel(currentMonth),
      expenseTotal: thisExpenseTotal,
      incomeTotal:  thisIncomeTotal,
      transactionCount: thisMonthRows.length,
      dateFrom: thisMonthFrom,
      dateTo:   thisMonthTo,
    },
    lastMonth: {
      label: getThaiMonthLabel(prevMonth),
      expenseTotal: lastExpenseTotal,
      incomeTotal:  lastIncomeTotal,
      transactionCount: lastMonthRows.length,
      dateFrom: lastMonthFrom,
      dateTo:   lastMonthTo,
    },
    expenseChange: calcPercentChange(thisExpenseTotal, lastExpenseTotal),
    incomeChange:  calcPercentChange(thisIncomeTotal,  lastIncomeTotal),
    categoryComparisons,
    topIncreased,
    isPartialMonth,
    compareDay: currentDay,
  };
}

/**
 * แปลงเดือน (1-12) เป็นชื่อเดือนภาษาไทยย่อ
 */
function getThaiMonthLabel(month) {
  const months = [
    '', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
  ];
  return months[month] || `เดือน ${month}`;
}

/**
 * เปรียบเทียบสัปดาห์นี้กับสัปดาห์ก่อน
 * @param {string|null} lineUserId
 * @returns {Object|null} comparison data
 */
async function compareWeeks(lineUserId) {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dayOfWeek = now.getUTCDay() || 7; // 1-7, 1=Monday
  
  // สัปดาห์นี้ (จันทร์ - วันนี้)
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - dayOfWeek + 1);
  
  // สัปดาห์ที่แล้ว (จันทร์ - อาทิตย์)
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
  
  const thisWeekFrom = fmt(thisMonday.getUTCFullYear(), thisMonday.getUTCMonth() + 1, thisMonday.getUTCDate());
  const thisWeekTo = fmt(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  
  const lastWeekFrom = fmt(lastMonday.getUTCFullYear(), lastMonday.getUTCMonth() + 1, lastMonday.getUTCDate());
  const lastWeekTo = fmt(lastSunday.getUTCFullYear(), lastSunday.getUTCMonth() + 1, lastSunday.getUTCDate());

  const [thisWeekRows, lastWeekRows] = await Promise.all([
    getMonthlyData(lineUserId, thisWeekFrom, thisWeekTo),
    getMonthlyData(lineUserId, lastWeekFrom, lastWeekTo),
  ]);

  if (thisWeekRows === null || lastWeekRows === null) return null;

  const thisExpense = thisWeekRows.filter(r => r.type === 'รายจ่าย');
  const thisIncome = thisWeekRows.filter(r => r.type === 'รายรับ');
  const lastExpense = lastWeekRows.filter(r => r.type === 'รายจ่าย');
  const lastIncome = lastWeekRows.filter(r => r.type === 'รายรับ');

  return {
    thisWeek: {
      totalExpense: sumAmount(thisExpense),
      totalIncome: sumAmount(thisIncome),
      byCategory: groupByCategory(thisExpense),
    },
    lastWeek: {
      totalExpense: sumAmount(lastExpense),
      totalIncome: sumAmount(lastIncome),
      byCategory: groupByCategory(lastExpense),
    },
    label: 'สัปดาห์นี้ vs สัปดาห์ก่อน'
  };
}

module.exports = {
  compareMonths,
  compareWeeks,
  calcPercentChange,
};
