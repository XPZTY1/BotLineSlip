/**
 * Flex Card สำหรับแสดงสถานะงบประมาณประจำเดือน
 */

function generateBudgetProgressFlex(budgets, currentExpensesTotal) {
  const overallBudget = budgets.find((b) => !b.category);
  const totalLimit = overallBudget ? Number(overallBudget.amount) : 0;
  const totalSpent = Number(currentExpensesTotal || 0);
  const pct = totalLimit > 0 ? Math.min(100, Math.round((totalSpent / totalLimit) * 100)) : 0;

  const barColor = pct >= 100 ? '#EF4444' : pct >= 80 ? '#F59E0B' : '#10B981';

  return {
    type: 'flex',
    altText: '📊 สถานะงบประมาณประจำเดือน',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '📊 งบประมาณเดือนนี้', weight: 'bold', color: '#FFFFFF', size: 'md' },
          { type: 'text', text: `ใช้ไปแล้ว ${pct}% ของงบประมาณรวม`, color: '#94A3B8', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: '16px',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ใช้จ่ายแล้ว:', size: 'xs', color: '#64748B' },
              { type: 'text', text: `${totalSpent.toLocaleString()} / ${totalLimit.toLocaleString()} ฿`, size: 'xs', weight: 'bold', align: 'right', color: '#0F172A' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#E2E8F0',
            cornerRadius: '6px',
            height: '10px',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: barColor,
                cornerRadius: '6px',
                height: '100%',
                width: `${pct}%`,
              },
            ],
          },
          {
            type: 'text',
            text: pct >= 100
              ? '🚨 ใช้จ่ายเกินงบรวมแล้ว! ควรระมัดระวังเป็นพิเศษ'
              : pct >= 80
              ? '⚠️ ใช้จ่ายเกิน 80% แล้ว ใกล้เต็มงบ!'
              : '✅ การใช้จ่ายยังอยู่ในเกณฑ์ดีครับ',
            size: 'xs',
            color: pct >= 80 ? '#DC2626' : '#059669',
            weight: 'bold',
            wrap: true,
          },
        ],
      },
    },
  };
}

module.exports = { generateBudgetProgressFlex };
