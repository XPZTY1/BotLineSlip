const { formatAmount } = require('./textReplies');

const CATEGORY_EMOJI = {
  อาหาร: '🍽️',
  เดินทาง: '🚗',
  ที่พัก: '🏠',
  ค่าน้ำค่าไฟ: '💡',
  ช้อปปิ้ง: '🛍️',
  สุขภาพ: '❤️',
  การศึกษา: '📚',
  บันเทิง: '🎬',
  เงินเดือน: '💼',
  โบนัส: '🎊',
  งานเสริม: '💪',
  ขายของ: '📦',
  ของขวัญ: '🎁',
  อื่นๆ: '📌',
};

function sumAmount(rows) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

function groupByCategory(rows) {
  return rows.reduce((grouped, row) => {
    grouped[row.category] = (grouped[row.category] || 0) + Number(row.amount);
    return grouped;
  }, {});
}

function topCategories(rows, limit) {
  return Object.entries(groupByCategory(rows))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function formatThaiDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

/**
 * สร้าง Flex components สำหรับแสดงเป้าหมายการออมใน Flex Summary
 * @param {Array} goals - Array of goal objects
 * @returns {Array} Flex components array
 */
function makeGoalsSection(goals) {
  if (!goals || goals.length === 0) return [];

  // จำกัดแสดงสูงสุด 2 เป้าหมาย เพื่อไม่ให้ Flex ใหญ่เกินไป
  const displayGoals = goals.slice(0, 2);

  const goalComponents = displayGoals.map((goal) => {
    const current = Number(goal.current_amount);
    const target = Number(goal.target_amount);
    const pct = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;
    const remaining = target - current;

    return {
      type: 'box',
      layout: 'vertical',
      margin: 'sm',
      backgroundColor: '#F0FDF4',
      cornerRadius: '8px',
      paddingAll: '10px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            makeText(`🎯 ${goal.name}`, { flex: 4, weight: 'bold', size: 'xs', color: '#065F46', maxLines: 1 }),
            makeText(`${pct}%`, { flex: 1, align: 'end', weight: 'bold', size: 'xs', color: '#10B981' }),
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'xs',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                makeText(`${formatAmount(current)} / ${formatAmount(target)} ฿`, { flex: 3, size: 'xxs', color: '#065F46', weight: 'bold' }),
                makeText(remaining > 0 ? `เหลือ ${formatAmount(remaining)} ฿` : '🎉 สำเร็จ!', { flex: 3, align: 'end', size: 'xxs', color: remaining > 0 ? '#6B7280' : '#10B981' }),
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'xs',
              height: '4px',
              backgroundColor: '#D1FAE5',
              cornerRadius: '2px',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  width: `${pct}%`,
                  height: '100%',
                  backgroundColor: '#10B981',
                  cornerRadius: '2px',
                },
              ],
            },
            makeText(`เดือนละ ${formatAmount(goal.monthly_amount)} ฿ (${goal.duration_months} ด.)`, { size: 'xxs', color: '#6B7280', margin: 'xs' }),
          ],
        },
      ],
    };
  });

  const moreText = goals.length > 2 ? makeText(`...และอีก ${goals.length - 2} เป้าหมาย`, { size: 'xxs', color: '#94A3B8', margin: 'sm', align: 'end' }) : null;

  return [
    makeText('🎯 เป้าหมายการออม', { size: 'xs', color: '#0F172A', weight: 'bold', margin: 'md' }),
    ...goalComponents,
    ...(moreText ? [moreText] : []),
  ];
}

function makeText(text, options = {}) {
  return {
    type: 'text',
    text,
    size: options.size || 'sm',
    color: options.color || '#334155',
    weight: options.weight,
    align: options.align,
    flex: options.flex,
    margin: options.margin,
    wrap: options.wrap,
    maxLines: options.maxLines,
  };
}

function makeMetricCard(label, value, color, backgroundColor) {
  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor,
    cornerRadius: '14px',
    paddingAll: '12px',
    flex: 1,
    contents: [
      makeText(label, { size: 'xs', color, weight: 'bold' }),
      makeText(value, { size: 'lg', color, weight: 'bold', maxLines: 1 }),
    ],
  };
}

function makeCategoryRows(categories, total) {
  if (categories.length === 0) {
    return [makeText('ยังไม่มีรายการ', { color: '#94A3B8' })];
  }

  return categories.map(([category, amount]) => {
    const percentage = total > 0 ? Math.round((amount / total) * 100) : 0;
    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: [
        makeText(`${CATEGORY_EMOJI[category] || '📌'} ${category}`, { flex: 4, maxLines: 1 }),
        makeText(`${percentage}%`, { flex: 1, align: 'end', color: '#64748B' }),
        makeText(`${formatAmount(amount)} ฿`, { flex: 2, align: 'end', weight: 'bold', color: '#0F172A' }),
      ],
    };
  });
}

function makeRecentRows(rows) {
  const recentRows = [...rows]
    .sort((a, b) => `${b.date}`.localeCompare(`${a.date}`))
    .slice(0, 3);

  if (recentRows.length === 0) {
    return [makeText('ยังไม่มีรายการล่าสุด', { color: '#94A3B8' })];
  }

  return recentRows.map((row) => {
    const isIncome = row.type === 'รายรับ';
    const color = isIncome ? '#059669' : '#DC2626';
    const sign = isIncome ? '+' : '-';
    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      margin: 'sm',
      contents: [
        makeText(formatThaiDate(row.date), { flex: 2, color: '#64748B', size: 'xs' }),
        makeText(row.item, { flex: 4, maxLines: 1 }),
        makeText(`${sign}${formatAmount(row.amount)} ฿`, { flex: 3, align: 'end', color, weight: 'bold' }),
      ],
    };
  });
}

function makeSection(title, contents) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'lg',
    contents: [
      makeText(title, { size: 'sm', color: '#0F172A', weight: 'bold' }),
      ...contents,
    ],
  };
}

function buildInsight({ net, totalIncome, totalExpense, expenseRows }) {
  if (net < 0) {
    return 'รายจ่ายสูงกว่ารายรับ ลองดูหมวดที่จ่ายเยอะสุดด้านบนก่อนครับ';
  }

  if (totalIncome === 0 && totalExpense > 0) {
    return 'ช่วงนี้มีแต่รายจ่าย ถ้ามีรายรับเข้ามาอย่าลืมบันทึกนะครับ';
  }

  if (totalIncome > 0 && totalExpense / totalIncome > 0.8) {
    return 'ใช้ไปเกิน 80% ของรายรับแล้ว คุมอีกนิดจะสวยมากครับ';
  }

  if (expenseRows.length === 0) {
    return 'ยังไม่มีรายจ่ายในช่วงนี้ กระแสเงินสดดูสดใสมากครับ';
  }

  return 'ภาพรวมยังดีครับ ดูหมวดจ่ายสูงสุดเพื่อจับจุดประหยัดต่อได้เลย';
}

function generateFlexSummary(rows, label, goals = null) {
  if (!rows || rows.length === 0) return null;

  const incomeRows = rows.filter((row) => row.type === 'รายรับ');
  const expenseRows = rows.filter((row) => row.type === 'รายจ่าย');
  const totalIncome = sumAmount(incomeRows);
  const totalExpense = sumAmount(expenseRows);
  const net = totalIncome - totalExpense;
  // ลดจำนวนหมวดหมู่ให้เหลือน้อยที่สุด
  const topExpenseCategories = topCategories(expenseRows, 2);
  const topIncomeCategories = topCategories(incomeRows, 1);
  const avgExpense = expenseRows.length > 0 ? totalExpense / expenseRows.length : 0;
  const netColor = net >= 0 ? '#059669' : '#DC2626';
  const netSign = net >= 0 ? '+' : '-';
  const insight = buildInsight({ net, totalIncome, totalExpense, expenseRows });
  const goalsSection = makeGoalsSection(goals);

  const bubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      backgroundColor: '#0F172A',
      contents: [
        makeText('สรุปรายรับรายจ่าย', { size: 'md', color: '#FFFFFF', weight: 'bold' }),
        makeText(`${label} • ${rows.length} รายการ`, { size: 'xs', color: '#CBD5E1', margin: 'xs' }),
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'xs',
          contents: [
            makeMetricCard('รายรับ', `${formatAmount(totalIncome)} ฿`, '#047857', '#ECFDF5'),
            makeMetricCard('รายจ่าย', `${formatAmount(totalExpense)} ฿`, '#B91C1C', '#FEF2F2'),
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: net >= 0 ? '#F0FDF4' : '#FFF1F2',
          cornerRadius: '12px',
          paddingAll: '10px',
          margin: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                makeText(net >= 0 ? 'คงเหลือสุทธิ' : 'ติดลบสุทธิ', { flex: 3, color: netColor, weight: 'bold', size: 'sm' }),
                makeText(`${netSign}${formatAmount(Math.abs(net))} ฿`, { flex: 3, color: netColor, weight: 'bold', align: 'end', size: 'md' }),
              ],
            },
          ],
        },
        makeSection('จ่ายมากสุด', makeCategoryRows(topExpenseCategories, totalExpense)),
        makeSection('รายรับ', makeCategoryRows(topIncomeCategories, totalIncome)),
        // เพิ่ม section เป้าหมายการออม (ถ้ามี)
        ...goalsSection,
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '10px',
      backgroundColor: '#F8FAFC',
      contents: [
        makeText(insight, { size: 'xxs', color: '#475569', wrap: true }),
      ],
    },
  };

  return {
    type: 'flex',
    altText: `สรุป${label}: รับ ${formatAmount(totalIncome)} จ่าย ${formatAmount(totalExpense)} คงเหลือ ${netSign}${formatAmount(Math.abs(net))} บาท`,
    contents: bubble,
  };
}

module.exports = { generateFlexSummary };
