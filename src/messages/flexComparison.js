/**
 * Flex Comparison Message
 * สร้าง LINE Flex Message สำหรับแสดงผลเปรียบเทียบรายจ่ายสองเดือน
 */
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

// ─── Primitive builders ──────────────────────────────────────────────────────

function makeText(text, options = {}) {
  return {
    type: 'text',
    text: String(text),
    size: options.size || 'sm',
    color: options.color || '#334155',
    weight: options.weight,
    align: options.align,
    flex: options.flex,
    margin: options.margin,
    wrap: options.wrap,
    maxLines: options.maxLines,
    decoration: options.decoration,
  };
}

function makeSeparator(margin = 'md') {
  return { type: 'separator', margin, color: '#E2E8F0' };
}

// ─── Builders ────────────────────────────────────────────────────────────────

/**
 * สร้างป้ายแสดง % เปลี่ยนแปลง
 * @param {Object} change - ผลจาก calcPercentChange
 * @param {number} diff   - ยอดต่าง (เดือนนี้ - เดือนก่อน) — บวก = เพิ่ม
 * @param {'expense'|'income'} mode
 */
function makeChangeBadge(change, diff, mode) {
  let badgeText;
  let badgeColor;
  let bgColor;

  if (change.noChange) {
    badgeText = '— ไม่เปลี่ยน';
    badgeColor = '#64748B';
    bgColor = '#F1F5F9';
  } else if (change.isNew) {
    badgeText = '✨ ใหม่';
    badgeColor = '#7C3AED';
    bgColor = '#F5F3FF';
  } else {
    const isUp = diff > 0;
    // สำหรับรายจ่าย: เพิ่ม = แย่ (แดง), ลด = ดี (เขียว)
    // สำหรับรายรับ: เพิ่ม = ดี (เขียว), ลด = แย่ (แดง)
    const isGood = mode === 'income' ? isUp : !isUp;
    const arrow = isUp ? '📈 +' : '📉 ';
    badgeText = `${arrow}${Math.abs(change.percent)}%`;
    badgeColor = isGood ? '#059669' : '#DC2626';
    bgColor    = isGood ? '#ECFDF5' : '#FEF2F2';
  }

  return {
    type: 'box',
    layout: 'vertical',
    backgroundColor: bgColor,
    cornerRadius: '8px',
    paddingAll: '4px',
    paddingStart: '8px',
    paddingEnd: '8px',
    contents: [makeText(badgeText, { size: 'xs', color: badgeColor, weight: 'bold' })],
  };
}

/**
 * การ์ดคู่แสดงยอดเดือนนี้ vs เดือนก่อน
 */
function makeSummaryCards(thisLabel, lastLabel, thisValue, lastValue, title, change, diff, mode) {
  const isUp = diff > 0;
  const isGood = mode === 'income' ? isUp : !isUp;
  const netColor = change.noChange
    ? '#64748B'
    : change.isNew
    ? '#7C3AED'
    : isGood
    ? '#059669'
    : '#DC2626';

  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    contents: [
      // Title
      makeText(title, { size: 'xs', color: '#64748B', weight: 'bold' }),
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        margin: 'sm',
        contents: [
          // เดือนก่อน (left, muted)
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            backgroundColor: '#F8FAFC',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              makeText(lastLabel, { size: 'xxs', color: '#94A3B8' }),
              makeText(`${formatAmount(lastValue)} ฿`, { size: 'md', color: '#475569', weight: 'bold' }),
            ],
          },
          // ลูกศร
          {
            type: 'box',
            layout: 'vertical',
            flex: 0,
            justifyContent: 'center',
            paddingAll: '4px',
            contents: [makeText('→', { size: 'sm', color: '#94A3B8', align: 'center' })],
          },
          // เดือนนี้ (right, highlighted)
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            backgroundColor: '#0F172A',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              makeText(thisLabel, { size: 'xxs', color: '#94A3B8' }),
              makeText(`${formatAmount(thisValue)} ฿`, { size: 'md', color: '#FFFFFF', weight: 'bold' }),
            ],
          },
        ],
      },
      // Badge % เปลี่ยน
      {
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        justifyContent: 'flex-end',
        contents: [makeChangeBadge(change, diff, mode)],
      },
    ],
  };
}

/**
 * แถวเปรียบเทียบแต่ละหมวดหมู่
 */
function makeCategoryComparisonRows(categoryComparisons) {
  if (!categoryComparisons || categoryComparisons.length === 0) {
    return [makeText('ไม่มีข้อมูลหมวดรายจ่าย', { color: '#94A3B8' })];
  }

  const top = categoryComparisons.slice(0, 6); // แสดงสูงสุด 6 หมวด

  return top.map((item) => {
    const { category, current, previous, diff, change } = item;
    const emoji = CATEGORY_EMOJI[category] || '📌';

    let changeText;
    let changeColor;
    if (change.noChange) {
      changeText = '—';
      changeColor = '#94A3B8';
    } else if (change.isNew) {
      changeText = 'ใหม่';
      changeColor = '#7C3AED';
    } else {
      const sign = change.percent > 0 ? '+' : '';
      changeText = `${sign}${change.percent}%`;
      changeColor = diff > 0 ? '#DC2626' : '#059669';
    }

    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'none',
      margin: 'sm',
      contents: [
        // หมวด + emoji
        makeText(`${emoji} ${category}`, { flex: 4, maxLines: 1, size: 'sm' }),
        // เดือนก่อน
        makeText(`${formatAmount(previous)}`, { flex: 3, align: 'end', color: '#64748B', size: 'xs' }),
        // ลูกศร
        makeText('→', { flex: 1, align: 'center', color: '#CBD5E1', size: 'xs' }),
        // เดือนนี้
        makeText(`${formatAmount(current)}`, { flex: 3, align: 'end', color: '#0F172A', size: 'sm', weight: 'bold' }),
        // % เปลี่ยน
        makeText(changeText, { flex: 2, align: 'end', color: changeColor, size: 'xs', weight: 'bold' }),
      ],
    };
  });
}

/**
 * สร้าง section พร้อม header
 */
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

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * สร้าง Flex Message เปรียบเทียบสองเดือน
 * @param {Object} data - ผลจาก compareMonths()
 * @returns {Object} LINE Flex Message object
 */
function generateFlexComparison(data) {
  if (!data) return null;

  const {
    thisMonth,
    lastMonth,
    expenseChange,
    incomeChange,
    categoryComparisons,
    topIncreased,
    isPartialMonth,
    compareDay,
  } = data;

  const expenseDiff = thisMonth.expenseTotal - lastMonth.expenseTotal;
  const incomeDiff  = thisMonth.incomeTotal  - lastMonth.incomeTotal;

  // ─── Footer insight ──────────────────────────────────────────────────────
  const footerLines = [];
  if (isPartialMonth) {
    footerLines.push(`⚠️ เดือนนี้ยังไม่จบ เทียบถึงวันที่ ${compareDay} ของทั้งสองเดือน`);
  }
  if (topIncreased) {
    const diffStr = formatAmount(topIncreased.diff);
    footerLines.push(`📌 หมวดพุ่งสุด: ${topIncreased.category} (+${diffStr} ฿)`);
  }
  if (footerLines.length === 0) {
    footerLines.push('✅ รายจ่ายทั้งสองเดือนใกล้เคียงกัน');
  }

  // ─── Category header row ─────────────────────────────────────────────────
  const catHeaderRow = {
    type: 'box',
    layout: 'horizontal',
    spacing: 'none',
    margin: 'sm',
    contents: [
      makeText('หมวด', { flex: 4, size: 'xxs', color: '#94A3B8' }),
      makeText(lastMonth.label, { flex: 3, align: 'end', size: 'xxs', color: '#94A3B8' }),
      makeText('', { flex: 1 }),
      makeText(thisMonth.label, { flex: 3, align: 'end', size: 'xxs', color: '#94A3B8' }),
      makeText('%', { flex: 2, align: 'end', size: 'xxs', color: '#94A3B8' }),
    ],
  };

  const bubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      backgroundColor: '#0F172A',
      contents: [
        makeText('📊 เปรียบเทียบรายจ่าย', { size: 'lg', color: '#FFFFFF', weight: 'bold' }),
        makeText(
          `${lastMonth.label} vs ${thisMonth.label}${isPartialMonth ? ` • ถึงวันที่ ${compareDay}` : ''}`,
          { size: 'sm', color: '#94A3B8', margin: 'xs' },
        ),
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        // ─── รายจ่าย summary ────────────────────────────────────────────
        makeSummaryCards(
          thisMonth.label,
          lastMonth.label,
          thisMonth.expenseTotal,
          lastMonth.expenseTotal,
          '💸 รายจ่ายรวม',
          expenseChange,
          expenseDiff,
          'expense',
        ),
        makeSeparator('lg'),
        // ─── รายรับ summary ─────────────────────────────────────────────
        makeSummaryCards(
          thisMonth.label,
          lastMonth.label,
          thisMonth.incomeTotal,
          lastMonth.incomeTotal,
          '💰 รายรับรวม',
          incomeChange,
          incomeDiff,
          'income',
        ),
        makeSeparator('lg'),
        // ─── Category breakdown ──────────────────────────────────────────
        makeSection('แยกตามหมวดรายจ่าย', [
          catHeaderRow,
          makeSeparator('xs'),
          ...makeCategoryComparisonRows(categoryComparisons),
        ]),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '14px',
      backgroundColor: '#F8FAFC',
      spacing: 'xs',
      contents: footerLines.map((line) =>
        makeText(line, { size: 'xs', color: '#475569', wrap: true }),
      ),
    },
  };

  const expSignStr = expenseDiff >= 0 ? `+${formatAmount(expenseDiff)}` : `-${formatAmount(Math.abs(expenseDiff))}`;
  return {
    type: 'flex',
    altText: `เปรียบเทียบ ${lastMonth.label} vs ${thisMonth.label}: รายจ่ายเปลี่ยน ${expSignStr} ฿`,
    contents: bubble,
  };
}

module.exports = { generateFlexComparison };
