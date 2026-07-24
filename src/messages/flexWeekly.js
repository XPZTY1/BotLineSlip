function formatAmount(value) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function calcChange(current, previous) {
  if (previous === 0 && current === 0) return { percent: 0, text: 'เท่าเดิม', color: '#94A3B8', arrow: '-' };
  if (previous === 0 && current > 0) return { percent: 100, text: '+100%', color: '#FB7185', arrow: '↑' };
  
  const diff = current - previous;
  const percent = (Math.abs(diff) / previous) * 100;
  
  if (diff > 0) return { percent, text: `+${percent.toFixed(1)}%`, color: '#FB7185', arrow: '↑' }; // รายจ่ายเพิ่ม=แย่ (แดง)
  if (diff < 0) return { percent, text: `-${percent.toFixed(1)}%`, color: '#34D399', arrow: '↓' }; // รายจ่ายลด=ดี (เขียว)
  return { percent: 0, text: 'เท่าเดิม', color: '#94A3B8', arrow: '-' };
}

function generateWeeklyComparisonFlex(thisWeekData, lastWeekData) {
  const expenseChange = calcChange(thisWeekData.totalExpense, lastWeekData.totalExpense);
  const incomeChange = calcChange(thisWeekData.totalIncome, lastWeekData.totalIncome);
  
  // กลับสีสำหรับรายรับ (เพิ่ม=เขียว, ลด=แดง)
  if (thisWeekData.totalIncome - lastWeekData.totalIncome > 0) {
    incomeChange.color = '#34D399';
  } else if (thisWeekData.totalIncome - lastWeekData.totalIncome < 0) {
    incomeChange.color = '#FB7185';
  }

  // หา Top 3 หมวดหมู่รายจ่ายสัปดาห์นี้
  const categories = Object.entries(thisWeekData.byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
    
  const topCategoriesFlex = categories.length > 0 ? categories.map(([cat, amount], index) => {
    return {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: `${index + 1}. ${cat}`,
          size: "sm",
          color: "#475569",
          flex: 2
        },
        {
          type: "text",
          text: `${formatAmount(amount)} ฿`,
          size: "sm",
          color: "#0F172A",
          align: "end",
          weight: "bold",
          flex: 1
        }
      ],
      margin: "sm"
    };
  }) : [
    {
      type: "text",
      text: "ไม่มีรายจ่ายในสัปดาห์นี้",
      size: "sm",
      color: "#94A3B8",
      align: "center",
      margin: "md"
    }
  ];

  return {
    type: 'flex',
    altText: '📈 สรุปเปรียบเทียบรายสัปดาห์',
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📈 Weekly Trend",
            weight: "bold",
            color: "#ffffff",
            size: "lg"
          },
          {
            type: "text",
            text: "เทียบสัปดาห์นี้กับสัปดาห์ก่อน",
            color: "#94A3B8",
            size: "xs",
            margin: "xs"
          }
        ],
        backgroundColor: "#0F172A",
        paddingAll: "20px"
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "รายจ่ายรวม",
                    size: "xs",
                    color: "#64748B"
                  },
                  {
                    type: "text",
                    text: `${formatAmount(thisWeekData.totalExpense)} ฿`,
                    size: "md",
                    weight: "bold",
                    color: "#FB7185",
                    margin: "sm"
                  }
                ],
                flex: 1
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: expenseChange.arrow,
                        color: expenseChange.color,
                        weight: "bold",
                        size: "sm",
                        flex: 0
                      },
                      {
                        type: "text",
                        text: expenseChange.text,
                        color: expenseChange.color,
                        weight: "bold",
                        size: "sm",
                        margin: "sm"
                      }
                    ],
                    alignItems: "center"
                  },
                  {
                    type: "text",
                    text: `จาก ${formatAmount(lastWeekData.totalExpense)}`,
                    size: "xxs",
                    color: "#94A3B8",
                    margin: "xs"
                  }
                ],
                alignItems: "flex-end",
                flex: 1
              }
            ],
            paddingAll: "16px",
            backgroundColor: "#F8FAFC",
            cornerRadius: "12px",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "text",
                    text: "รายรับรวม",
                    size: "xs",
                    color: "#64748B"
                  },
                  {
                    type: "text",
                    text: `${formatAmount(thisWeekData.totalIncome)} ฿`,
                    size: "md",
                    weight: "bold",
                    color: "#34D399",
                    margin: "sm"
                  }
                ],
                flex: 1
              },
              {
                type: "box",
                layout: "vertical",
                contents: [
                  {
                    type: "box",
                    layout: "horizontal",
                    contents: [
                      {
                        type: "text",
                        text: incomeChange.arrow,
                        color: incomeChange.color,
                        weight: "bold",
                        size: "sm",
                        flex: 0
                      },
                      {
                        type: "text",
                        text: incomeChange.text,
                        color: incomeChange.color,
                        weight: "bold",
                        size: "sm",
                        margin: "sm"
                      }
                    ],
                    alignItems: "center"
                  },
                  {
                    type: "text",
                    text: `จาก ${formatAmount(lastWeekData.totalIncome)}`,
                    size: "xxs",
                    color: "#94A3B8",
                    margin: "xs"
                  }
                ],
                alignItems: "flex-end",
                flex: 1
              }
            ],
            paddingAll: "16px",
            backgroundColor: "#F8FAFC",
            cornerRadius: "12px",
            margin: "sm"
          },
          {
            type: "separator",
            margin: "xl"
          },
          {
            type: "text",
            text: "🏆 จ่ายหนักสุด 3 อันดับแรก",
            weight: "bold",
            size: "sm",
            color: "#0F172A",
            margin: "lg"
          },
          {
            type: "box",
            layout: "vertical",
            contents: topCategoriesFlex,
            margin: "md"
          }
        ],
        paddingAll: "20px"
      }
    }
  };
}

module.exports = { generateWeeklyComparisonFlex };
