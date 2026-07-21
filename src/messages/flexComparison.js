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

/**
 * สร้าง text component โดยกรอง undefined ออกก่อนส่งให้ LINE
 */
function makeText(text, options = {}) {
  const obj = {
    type: 'text',
    text: String(text) || ' ',
    size: options.size || 'sm',
    color: options.color || '#334155',
  };
  if (options.weight !== undefined) obj.weight = options.weight;
  if (options.align !== undefined) obj.align = options.align;
  if (options.flex !== undefined) obj.flex = options.flex;
  if (options.margin !== undefined) obj.margin = options.margin;
  if (options.wrap !== undefined) obj.wrap = options.wrap;
  if (options.maxLines !== undefined) obj.maxLines = options.maxLines;
  return obj;
}

function makeSeparator(margin = 'md') {
  return { type: 'separator', margin, color: '#E2E8F0' };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

/**
 * สร้าง text badge แสดง % เปลี่ยนแปลง (เป็น text ธรรมดา ไม่ใช่ box ซ้อน)
 */
function buildChangeLabel(change, diff, mode) {
  if (change.noChange) return { text: '— ไม่เปลี่ยน', color: '#64748B' };
  if (change.isNew) return { text: '✨ ใหม่', color: '#7C3AED' };

  const isUp = diff > 0;
  const isGood = mode === 'income' ? isUp : !isUp;
  const sign = isUp ? '+' : '';
  return {
    text: `${isUp ? '▲' : '▼'} ${sign}${Math.abs(change.percent)}%`,
    color: isGood ? '#059669' : '#DC2626',
  };
}

/**
 * การ์ดคู่แสดงยอดเดือนนี้ vs เดือนก่อน
 */
function makeSummaryCards(thisLabel, lastLabel, thisValue, lastValue, title, change, diff, mode) {
  const changeLabel = buildChangeLabel(change, diff, mode);

  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    contents: [
      // Title row
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          makeText(title, { flex: 3, size: 'xs', color: '#64748B', weight: 'bold' }),
          makeText(changeLabel.text, { flex: 2, align: 'end', size: 'xs', color: changeLabel.color, weight: 'bold' }),
        ],
      },
      // Card row: เดือนก่อน → เดือนนี้
      {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        margin: 'sm',
        contents: [
          // เดือนก่อน
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            backgroundColor: '#F8FAFC',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              makeText(lastLabel, { size: 'xs', color: '#94A3B8' }),
              makeText(`${formatAmount(lastValue)} ฿`, { size: 'md', color: '#475569', weight: 'bold' }),
            ],
          },
          // ลูกศร (ใช้ flex: 1 ไม่ใช่ 0)
          {
            type: 'box',
            layout: 'vertical',
            flex: 1,
            paddingAll: '4px',
            contents: [
              makeText('→', { size: 'sm', color: '#94A3B8', align: 'center' }),
            ],
          },
          // เดือนนี้
          {
            type: 'box',
            layout: 'vertical',
            flex: 5,
            backgroundColor: '#0F172A',
            cornerRadius: '10px',
            paddingAll: '10px',
            contents: [
              makeText(thisLabel, { size: 'xs', color: '#94A3B8' }),
              makeText(`${formatAmount(thisValue)} ฿`, { size: 'md', color: '#FFFFFF', weight: 'bold' }),
            ],
          },
        ],
      },
    ],
  };
}

/**
 * header row ของตารางหมวด
 */
function makeCategoryHeaderRow(lastLabel, thisLabel) {
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      makeText('หมวด', { flex: 4, size: 'xs', color: '#94A3B8' }),
      makeText(lastLabel, { flex: 3, align: 'end', size: 'xs', color: '#94A3B8' }),
      makeText(thisLabel, { flex: 3, align: 'end', size: 'xs', color: '#94A3B8' }),
      makeText('%', { flex: 2, align: 'end', size: 'xs', color: '#94A3B8' }),
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

  const top = categoryComparisons.slice(0, 6);

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
      margin: 'sm',
      contents: [
        makeText(`${emoji} ${category}`, { flex: 4, maxLines: 1, size: 'sm' }),
        makeText(`${formatAmount(previous)}`, { flex: 3, align: 'end', color: '#64748B', size: 'xs' }),
        makeText(`${formatAmount(current)}`, { flex: 3, align: 'end', color: '#0F172A', size: 'sm', weight: 'bold' }),
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

  // ─── Footer lines ────────────────────────────────────────────────────────
  const footerContents = [];
  if (isPartialMonth) {
    footerContents.push(
      makeText(`⚠️ เดือนนี้ยังไม่จบ เทียบถึงวันที่ ${compareDay} ของทั้งสองเดือน`, {
        size: 'xs',
        color: '#92400E',
        wrap: true,
      }),
    );
  }
  if (topIncreased) {
    footerContents.push(
      makeText(`📌 หมวดพุ่งสุด: ${topIncreased.category} (+${formatAmount(topIncreased.diff)} ฿)`, {
        size: 'xs',
        color: '#475569',
        wrap: true,
      }),
    );
  }
  if (footerContents.length === 0) {
    footerContents.push(
      makeText('✅ รายจ่ายทั้งสองเดือนใกล้เคียงกัน', { size: 'xs', color: '#475569', wrap: true }),
    );
  }

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
      spacing: 'sm',
      contents: [
        // ─── รายจ่าย ────────────────────────────────────────────────────
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
        // ─── รายรับ ─────────────────────────────────────────────────────
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
          makeCategoryHeaderRow(lastMonth.label, thisMonth.label),
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
      contents: footerContents,
    },
  };

  const expSignStr =
    expenseDiff >= 0
      ? `+${formatAmount(expenseDiff)}`
      : `-${formatAmount(Math.abs(expenseDiff))}`;

  return {
    type: 'flex',
    altText: `เปรียบเทียบ ${lastMonth.label} vs ${thisMonth.label}: รายจ่ายเปลี่ยน ${expSignStr} บาท`,
    contents: bubble,
  };
}

module.exports = { generateFlexComparison };
