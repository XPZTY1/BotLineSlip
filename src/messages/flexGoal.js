const { formatAmount } = require('./textReplies');

function generateGoalCreatedFlex(goal) {
  return {
    type: 'flex',
    altText: `ตั้งเป้าหมาย ${goal.name} สำเร็จ`,
    contents: {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '🎯 ตั้งเป้าหมายสำเร็จ!',
            weight: 'bold',
            color: '#1DB446',
            size: 'md'
          },
          {
            type: 'text',
            text: goal.name,
            weight: 'bold',
            size: 'xl',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'เป้าหมาย', size: 'sm', color: '#8c8c8c', flex: 1 },
                  { type: 'text', text: `${formatAmount(goal.target_amount)} ฿`, size: 'sm', color: '#111111', align: 'end', weight: 'bold' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ระยะเวลา', size: 'sm', color: '#8c8c8c', flex: 1 },
                  { type: 'text', text: `${goal.duration_months} เดือน`, size: 'sm', color: '#111111', align: 'end', weight: 'bold' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: 'ต้องเก็บเดือนละ', size: 'sm', color: '#8c8c8c', flex: 1 },
                  { type: 'text', text: `${formatAmount(goal.monthly_amount)} ฿`, size: 'sm', color: '#EF454D', align: 'end', weight: 'bold' }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}

function generateGoalsProgressFlex(goals) {
  if (!goals || goals.length === 0) return null;

  const bubbles = goals.map(goal => {
    const progressPct = Math.min(100, Math.floor((Number(goal.current_amount) / Number(goal.target_amount)) * 100));
    
    return {
      type: 'bubble',
      size: 'mega',
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '🎯 เป้าหมายการออม',
            color: '#1DB446',
            size: 'xs',
            weight: 'bold'
          },
          {
            type: 'text',
            text: goal.name,
            weight: 'bold',
            size: 'xl',
            margin: 'md'
          },
          {
            type: 'text',
            text: `${formatAmount(goal.current_amount)} / ${formatAmount(goal.target_amount)} ฿`,
            size: 'md',
            color: '#111111',
            margin: 'md'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '100%',
                height: '8px',
                backgroundColor: '#E5E5E5',
                cornerRadius: '10px',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: `${progressPct}%`,
                    height: '100%',
                    backgroundColor: '#1DB446',
                    cornerRadius: '10px',
                    contents: []
                  }
                ]
              }
            ]
          },
          {
            type: 'text',
            text: `${progressPct}% สำเร็จแล้ว`,
            size: 'xs',
            color: '#8c8c8c',
            margin: 'sm',
            align: 'end'
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'lg',
            contents: [
              { type: 'text', text: 'ต้องเก็บเดือนละ', size: 'sm', color: '#8c8c8c' },
              { type: 'text', text: `${formatAmount(goal.monthly_amount)} ฿`, size: 'sm', color: '#111111', align: 'end', weight: 'bold' }
            ]
          }
        ]
      }
    };
  });

  return {
    type: 'flex',
    altText: 'ความคืบหน้าเป้าหมายการออม',
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

module.exports = {
  generateGoalCreatedFlex,
  generateGoalsProgressFlex
};
