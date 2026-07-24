/**
 * Flex Card สำหรับ AI Financial Coach
 */

function generateCoachFlex(coachData) {
  const { monthLabel, headline, pattern_insight, top_saving_tip, encouragement, incomeTotal, expenseTotal } = coachData;

  return {
    type: 'flex',
    altText: `🤖 AI Financial Coach - สรุปคำแนะนำ ${monthLabel}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F172A',
        paddingAll: '16px',
        contents: [
          {
            type: 'text',
            text: '🤖 AI FINANCIAL COACH',
            weight: 'bold',
            color: '#38BDF8',
            size: 'xs',
          },
          {
            type: 'text',
            text: headline || `คำแนะนำประจำเดือน ${monthLabel}`,
            weight: 'bold',
            color: '#FFFFFF',
            size: 'md',
            margin: 'xs',
            wrap: true,
          },
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
            backgroundColor: '#F8FAFC',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'รายรับเดือนนี้', size: 'xxs', color: '#64748B' },
                  { type: 'text', text: `+${Number(incomeTotal).toLocaleString()} ฿`, size: 'sm', weight: 'bold', color: '#059669' },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  { type: 'text', text: 'รายจ่ายเดือนนี้', size: 'xxs', color: '#64748B' },
                  { type: 'text', text: `-${Number(expenseTotal).toLocaleString()} ฿`, size: 'sm', weight: 'bold', color: '#DC2626' },
                ],
              },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: [
              { type: 'text', text: '📊 Insight พฤติกรรม:', size: 'xs', weight: 'bold', color: '#334155' },
              { type: 'text', text: pattern_insight || '-', size: 'xs', color: '#475569', wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            backgroundColor: '#FEF3C7',
            cornerRadius: '8px',
            paddingAll: '10px',
            contents: [
              { type: 'text', text: '💡 คำแนะนำประหยัดเงิน:', size: 'xs', weight: 'bold', color: '#D97706' },
              { type: 'text', text: top_saving_tip || '-', size: 'xs', color: '#92400E', wrap: true },
            ],
          },
          {
            type: 'text',
            text: `💬 "${encouragement || 'สู้ๆ นะครับ มีสติทุกการใช้จ่าย!'}"`,
            size: 'xs',
            color: '#64748B',
            style: 'italic',
            align: 'center',
            wrap: true,
            margin: 'sm',
          },
        ],
      },
    },
  };
}

module.exports = { generateCoachFlex };
