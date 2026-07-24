/**
 * Render หน้าเว็บ HTML แสดงรายการทั้งหมดของผู้ใช้
 * ใช้เปิดจากปุ่มใน Flex Message (LINE in-app browser)
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value) {
  return Number(value).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatThaiDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

function groupByDate(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date).push(row);
  });
  // เรียงวันที่ล่าสุดก่อน
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function renderRow(row) {
  const isIncome = row.type === 'รายรับ';
  const sign = isIncome ? '+' : '-';
  const colorClass = isIncome ? 'income' : 'expense';

  return `
    <div class="row">
      <div class="row-main">
        <div class="row-item">${escapeHtml(row.item)}</div>
        <div class="row-category">${escapeHtml(row.category)}</div>
      </div>
      <div class="row-amount ${colorClass}">${sign}${formatAmount(row.amount)} ฿</div>
    </div>`;
}

function renderDateGroup([date, rows]) {
  const dayTotal = rows.reduce((sum, row) => {
    const value = Number(row.amount) * (row.type === 'รายรับ' ? 1 : -1);
    return sum + value;
  }, 0);
  const dayColor = dayTotal >= 0 ? 'income' : 'expense';
  const daySign = dayTotal >= 0 ? '+' : '-';

  return `
    <div class="date-group">
      <div class="date-header">
        <span>${formatThaiDate(date)}</span>
        <span class="${dayColor}">${daySign}${formatAmount(Math.abs(dayTotal))} ฿</span>
      </div>
      ${rows.map(renderRow).join('')}
    </div>`;
}

function renderGoalsSection(goals) {
  if (!goals || goals.length === 0) return '';

  const goalsHtml = goals.map((goal) => {
    const current = Number(goal.current_amount);
    const target = Number(goal.target_amount);
    const pct = Math.min(100, Math.floor((current / target) * 100));

    return `
      <div class="goal-card">
        <div class="goal-header">
          <span class="goal-name">🎯 ${escapeHtml(goal.name)}</span>
          <span class="goal-pct">${pct}%</span>
        </div>
        <div class="goal-bar-bg">
          <div class="goal-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="goal-footer">
          <span>${formatAmount(current)} / ${formatAmount(target)} ฿</span>
          <span>ออมเดือนละ ${formatAmount(goal.monthly_amount)} ฿ (${goal.duration_months} ด.)</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="goals-wrapper">
      <div class="section-heading">🎯 เป้าหมายการออม</div>
      ${goalsHtml}
    </div>`;
}

function renderTransactionsPage(rows, goals) {
  const safeRows = rows || [];
  const totalIncome = safeRows
    .filter((row) => row.type === 'รายรับ')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const totalExpense = safeRows
    .filter((row) => row.type === 'รายจ่าย')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? 'income' : 'expense';
  const netSign = net >= 0 ? '+' : '-';

  const dateGroups = groupByDate(safeRows);
  const listHtml = dateGroups.length > 0
    ? dateGroups.map(renderDateGroup).join('')
    : '<div class="empty">ยังไม่มีรายการบันทึกไว้</div>';

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<title>รายการทั้งหมด</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Sarabun', sans-serif;
    background: #F8FAFC;
    color: #0F172A;
    padding-bottom: 24px;
  }
  .header {
    background: #0F172A;
    color: #fff;
    padding: 20px 16px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header h1 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .summary { display: flex; gap: 10px; }
  .summary-card {
    flex: 1;
    background: rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 10px 12px;
  }
  .summary-label { font-size: 11px; color: #CBD5E1; }
  .summary-value { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .net-bar {
    margin-top: 10px;
    background: rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .net-bar .net-label { font-size: 13px; color: #CBD5E1; }
  .net-bar .net-value { font-size: 17px; font-weight: 700; }
  .income { color: #34D399; }
  .expense { color: #FB7185; }
  .date-group { margin: 16px 12px; }
  .date-header {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 700;
    color: #64748B;
    padding: 0 4px 8px;
  }
  .row {
    background: #fff;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .row-item { font-size: 14px; font-weight: 600; }
  .row-category { font-size: 12px; color: #94A3B8; margin-top: 2px; }
  .row-amount { font-size: 14px; font-weight: 700; white-space: nowrap; }
  .empty {
    text-align: center;
    color: #94A3B8;
    padding: 60px 20px;
    font-size: 14px;
  }
  .goals-wrapper {
    margin: 16px 12px 0;
  }
  .section-heading {
    font-size: 14px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 10px;
  }
  .goal-card {
    background: #fff;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 10px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .goal-header {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .goal-pct {
    color: #10B981;
  }
  .goal-bar-bg {
    background: #E2E8F0;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  .goal-bar-fill {
    background: #10B981;
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .goal-footer {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #64748B;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>💰 รายการทั้งหมด</h1>
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">รายรับรวม</div>
        <div class="summary-value income">${formatAmount(totalIncome)} ฿</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">รายจ่ายรวม</div>
        <div class="summary-value expense">${formatAmount(totalExpense)} ฿</div>
      </div>
    </div>
    <div class="net-bar">
      <span class="net-label">${net >= 0 ? 'คงเหลือสุทธิ' : 'ติดลบสุทธิ'}</span>
      <span class="net-value ${netColor}">${netSign}${formatAmount(Math.abs(net))} ฿</span>
    </div>
  </div>
  ${renderGoalsSection(goals)}
  <div class="list">
    ${listHtml}
  </div>
</body>
</html>`;
}

module.exports = { renderTransactionsPage };