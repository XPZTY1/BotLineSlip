/**
 * PDF Template
 * สร้าง HTML string สำหรับแปลงเป็น PDF รายงานรายรับรายจ่าย
 */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(value) {
  return Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatThaiDate(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

function formatThaiDateShort(dateValue) {
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

function groupByDate(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!groups.has(row.date)) groups.set(row.date, []);
    groups.get(row.date).push(row);
  });
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function groupByCategory(rows) {
  return rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + Number(row.amount);
    return acc;
  }, {});
}

function renderCategoryRows(expenseRows, totalExpense) {
  const catMap = groupByCategory(expenseRows);
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return '<tr><td colspan="3" style="text-align:center;color:#94A3B8;">ไม่มีรายจ่าย</td></tr>';
  return sorted.map(([cat, amt]) => {
    const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
    return `
      <tr>
        <td>${escapeHtml(cat)}</td>
        <td style="text-align:center;color:#64748B;">${pct}%</td>
        <td style="text-align:right;font-weight:700;color:#DC2626;">${formatAmount(amt)} ฿</td>
      </tr>`;
  }).join('');
}

function renderTransactionRows(dateGroups) {
  if (dateGroups.length === 0) {
    return `<tr><td colspan="4" style="text-align:center;color:#94A3B8;padding:20px;">ไม่มีรายการในช่วงนี้</td></tr>`;
  }

  return dateGroups.map(([date, rows]) => {
    const rowsHtml = rows.map((row) => {
      const isIncome = row.type === 'รายรับ';
      const sign = isIncome ? '+' : '-';
      const color = isIncome ? '#059669' : '#DC2626';
      return `
        <tr>
          <td></td>
          <td>${escapeHtml(row.item)}</td>
          <td style="color:#64748B;font-size:11px;">${escapeHtml(row.category)}</td>
          <td style="text-align:right;font-weight:700;color:${color};">${sign}${formatAmount(row.amount)} ฿</td>
        </tr>`;
    }).join('');

    return `
      <tr class="date-row">
        <td colspan="4" style="background:#F1F5F9;font-weight:700;color:#475569;font-size:12px;padding:6px 10px;">
          ${formatThaiDateShort(date)}
        </td>
      </tr>
      ${rowsHtml}`;
  }).join('');
}

/**
 * สร้าง HTML string สำหรับ PDF
 * @param {Array} rows - รายการจาก Supabase
 * @param {string} label - ชื่อช่วงเวลา เช่น "กรกฎาคม 2569"
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} dateTo - YYYY-MM-DD
 * @returns {string} HTML string
 */
function renderPdfHtml(rows, label, dateFrom, dateTo) {
  const safeRows = rows || [];
  const incomeRows  = safeRows.filter((r) => r.type === 'รายรับ');
  const expenseRows = safeRows.filter((r) => r.type === 'รายจ่าย');
  const totalIncome  = incomeRows.reduce((s, r)  => s + Number(r.amount), 0);
  const totalExpense = expenseRows.reduce((s, r) => s + Number(r.amount), 0);
  const net = totalIncome - totalExpense;
  const netColor = net >= 0 ? '#059669' : '#DC2626';
  const netSign  = net >= 0 ? '+' : '-';

  const dateGroups = groupByDate(safeRows);
  const printedAt = new Date(Date.now() + 7 * 60 * 60 * 1000).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok',
  });

  const dateRangeStr = dateFrom && dateTo
    ? `${formatThaiDate(dateFrom)} – ${formatThaiDate(dateTo)}`
    : label;

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>สรุปรายการ ${label}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Sarabun', -apple-system, sans-serif;
    font-size: 13px;
    color: #0F172A;
    background: #fff;
    padding: 32px 36px;
  }

  /* ─── Header ─────────────────────────────── */
  .report-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #0F172A;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .report-title { font-size: 22px; font-weight: 700; color: #0F172A; }
  .report-subtitle { font-size: 13px; color: #64748B; margin-top: 4px; }
  .report-meta { text-align: right; font-size: 11px; color: #94A3B8; line-height: 1.8; }

  /* ─── Summary Cards ──────────────────────── */
  .summary-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  .summary-card {
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card-income  { background: #ECFDF5; border-left: 4px solid #059669; }
  .card-expense { background: #FEF2F2; border-left: 4px solid #DC2626; }
  .card-net     { background: #EFF6FF; border-left: 4px solid #2563EB; }
  .card-label { font-size: 11px; color: #64748B; font-weight: 600; margin-bottom: 4px; }
  .card-value { font-size: 18px; font-weight: 700; }
  .card-count { font-size: 11px; color: #94A3B8; margin-top: 2px; }

  /* ─── Section title ──────────────────────── */
  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: #0F172A;
    background: #F8FAFC;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    margin-top: 20px;
  }

  /* ─── Tables ─────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    background: #0F172A;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
  }
  td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #FAFAFA; }
  .date-row td { background: #F1F5F9 !important; }

  /* ─── Footer ─────────────────────────────── */
  .report-footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #E2E8F0;
    font-size: 11px;
    color: #94A3B8;
    text-align: center;
  }

  /* ─── Print ──────────────────────────────── */
  @media print {
    body { padding: 16px; }
    .section-title { break-after: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="report-title">💰 รายงานรายรับรายจ่าย</div>
      <div class="report-subtitle">${escapeHtml(label)}</div>
      <div class="report-subtitle" style="color:#94A3B8;font-size:11px;">${escapeHtml(dateRangeStr)}</div>
    </div>
    <div class="report-meta">
      <div>วันที่พิมพ์</div>
      <div>${printedAt}</div>
      <div style="margin-top:4px;">รายการทั้งหมด: ${safeRows.length} รายการ</div>
    </div>
  </div>

  <!-- Summary Cards -->
  <div class="summary-grid">
    <div class="summary-card card-income">
      <div class="card-label">รายรับรวม</div>
      <div class="card-value" style="color:#059669;">+${formatAmount(totalIncome)} ฿</div>
      <div class="card-count">${incomeRows.length} รายการ</div>
    </div>
    <div class="summary-card card-expense">
      <div class="card-label">รายจ่ายรวม</div>
      <div class="card-value" style="color:#DC2626;">-${formatAmount(totalExpense)} ฿</div>
      <div class="card-count">${expenseRows.length} รายการ</div>
    </div>
    <div class="summary-card card-net">
      <div class="card-label">${net >= 0 ? 'คงเหลือสุทธิ' : 'ติดลบสุทธิ'}</div>
      <div class="card-value" style="color:${netColor};">${netSign}${formatAmount(Math.abs(net))} ฿</div>
      <div class="card-count">รายการสุทธิ</div>
    </div>
  </div>

  <!-- Category Summary -->
  <div class="section-title">📊 สรุปตามหมวดรายจ่าย</div>
  <table>
    <thead>
      <tr>
        <th>หมวดหมู่</th>
        <th style="text-align:center;">สัดส่วน</th>
        <th style="text-align:right;">ยอดรวม</th>
      </tr>
    </thead>
    <tbody>
      ${renderCategoryRows(expenseRows, totalExpense)}
    </tbody>
  </table>

  <!-- Transaction List -->
  <div class="section-title">📋 รายการทั้งหมด</div>
  <table>
    <thead>
      <tr>
        <th style="width:80px;">วันที่</th>
        <th>รายการ</th>
        <th style="width:90px;">หมวด</th>
        <th style="text-align:right;width:110px;">จำนวนเงิน</th>
      </tr>
    </thead>
    <tbody>
      ${renderTransactionRows(dateGroups)}
    </tbody>
  </table>

  <!-- Footer -->
  <div class="report-footer">
    สร้างโดย ManageMoney LINE Bot • ${printedAt} • ข้อมูลจาก Supabase
  </div>

</body>
</html>`;
}

module.exports = { renderPdfHtml };
