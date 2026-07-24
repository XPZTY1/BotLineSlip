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
  // เรียงวันที่ล่าสุดก่อน และภายในแต่ละวันให้เรียง id มากสุด (บันทึกล่าสุด) ขึ้นบน
  const sorted = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  sorted.forEach(([, rowList]) => rowList.sort((a, b) => Number(b.id) - Number(a.id)));
  return sorted;
}

function renderRow(row) {
  const isIncome = row.type === 'รายรับ';
  const sign = isIncome ? '+' : '-';
  const colorClass = isIncome ? 'income' : 'expense';
  const rowData = escapeHtml(JSON.stringify(row));

  return `
    <div class="row" onclick='openDetailModal(${rowData})'>
      <div class="row-left">
        <div class="row-icon ${colorClass}-bg">${isIncome ? '💚' : '💸'}</div>
        <div class="row-main">
          <div class="row-item">${escapeHtml(row.item)}</div>
          <div class="row-category">${escapeHtml(row.category)}</div>
        </div>
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
  /* Row clickable */
  .row { cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; }
  .row:active { transform: scale(0.98); box-shadow: none; }
  .row-left { display: flex; align-items: center; gap: 10px; }
  .row-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .income-bg { background: #ECFDF5; }
  .expense-bg { background: #FEF2F2; }

  /* Detail Sheet (slide-up) */
  .sheet-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 100; }
  .sheet-overlay.open { display: block; }
  .sheet { position: fixed; bottom: -100%; left: 0; width: 100%; background: #1E293B; border-radius: 24px 24px 0 0; padding: 0 20px 32px; z-index: 101; transition: bottom 0.3s cubic-bezier(0.32,0.72,0,1); max-height: 90vh; overflow-y: auto; }
  .sheet.open { bottom: 0; }
  .sheet-handle { width: 40px; height: 4px; background: #475569; border-radius: 2px; margin: 12px auto 20px; }
  .sheet-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
  .sheet-badge.income { background: #064E3B; color: #34D399; }
  .sheet-badge.expense { background: #7F1D1D; color: #FB7185; }
  .sheet-amount { font-size: 32px; font-weight: 800; margin-bottom: 20px; }
  .sheet-divider { height: 1px; background: #334155; margin: 16px 0; }
  .sheet-detail-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; }
  .sheet-detail-label { font-size: 13px; color: #64748B; }
  .sheet-detail-value { font-size: 14px; font-weight: 600; color: #F1F5F9; text-align: right; max-width: 60%; }
  .sheet-actions { display: flex; gap: 10px; margin-top: 24px; }
  .sheet-btn { flex: 1; padding: 14px; border: none; border-radius: 14px; font-size: 15px; font-weight: 700; cursor: pointer; }
  .sheet-btn-edit { background: #1D4ED8; color: #fff; }
  .sheet-btn-delete { background: #7F1D1D; color: #FB7185; }

  /* Edit Modal */
  .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 110; align-items: flex-end; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: #1E293B; color: #fff; padding: 20px 20px 32px; border-radius: 24px 24px 0 0; width: 100%; box-shadow: 0 -4px 24px rgba(0,0,0,0.3); }
  .modal h2 { font-size: 18px; margin-bottom: 16px; color: #F8FAFC; }
  .form-group { margin-bottom: 12px; }
  .form-group label { display: block; font-size: 13px; margin-bottom: 4px; color: #94A3B8; }
  .form-group input, .form-group select { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid #334155; background: #0F172A; color: #fff; font-size: 14px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .btn { padding: 10px 20px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; }
  .btn-cancel { background: #334155; color: #fff; }
  .btn-save { background: #3B82F6; color: #fff; }
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

  <!-- Detail Sheet -->
  <div id="sheetOverlay" class="sheet-overlay" onclick="closeDetailModal(event)"></div>
  <div id="detailSheet" class="sheet">
    <div class="sheet-handle"></div>
    <span id="sheetBadge" class="sheet-badge"></span>
    <div id="sheetAmount" class="sheet-amount"></div>
    <div class="sheet-divider"></div>
    <div class="sheet-detail-row"><span class="sheet-detail-label">📝 รายการ</span><span id="sheetItem" class="sheet-detail-value"></span></div>
    <div class="sheet-detail-row"><span class="sheet-detail-label">🗂️ หมวดหมู่</span><span id="sheetCategory" class="sheet-detail-value"></span></div>
    <div class="sheet-detail-row"><span class="sheet-detail-label">📅 วันที่</span><span id="sheetDate" class="sheet-detail-value"></span></div>
    <div class="sheet-detail-row" id="sheetTagsRow" style="display:none"><span class="sheet-detail-label">🏷️ แท็ก</span><span id="sheetTags" class="sheet-detail-value"></span></div>
    <div class="sheet-actions">
      <button class="sheet-btn sheet-btn-edit" onclick="openEditFromSheet()">✏️ แก้ไข</button>
      <button class="sheet-btn sheet-btn-delete" onclick="deleteFromSheet()">🗑️ ลบ</button>
    </div>
  </div>

  <!-- Edit Modal -->
  <div id="editModal" class="modal-overlay">
    <div class="modal">
      <h2>✏️ แก้ไขรายการ</h2>
      <input type="hidden" id="editId">
      <div class="form-group">
        <label>ชื่อรายการ</label>
        <input type="text" id="editItem">
      </div>
      <div class="form-group">
        <label>จำนวนเงิน (บาท)</label>
        <input type="number" id="editAmount" step="0.01">
      </div>
      <div class="form-group">
        <label>หมวดหมู่</label>
        <input type="text" id="editCategory">
      </div>
      <div class="modal-actions">
        <button class="btn btn-cancel" onclick="closeEditModal()">ยกเลิก</button>
        <button class="btn btn-save" onclick="saveEdit()">บันทึก</button>
      </div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId') || window.location.pathname.split('/').pop();
    let currentRow = null;

    function formatThaiDateJS(dateStr) {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
    }

    function openDetailModal(row) {
      currentRow = row;
      const isIncome = row.type === 'รายรับ';
      const sign = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'income' : 'expense';

      const badge = document.getElementById('sheetBadge');
      badge.textContent = isIncome ? '💚 รายรับ' : '💸 รายจ่าย';
      badge.className = 'sheet-badge ' + colorClass;

      const amountEl = document.getElementById('sheetAmount');
      amountEl.textContent = sign + Number(row.amount).toLocaleString('th-TH') + ' ฿';
      amountEl.className = 'sheet-amount ' + colorClass;

      document.getElementById('sheetItem').textContent = row.item || '-';
      document.getElementById('sheetCategory').textContent = row.category || '-';
      document.getElementById('sheetDate').textContent = formatThaiDateJS(row.date);

      const tagsRow = document.getElementById('sheetTagsRow');
      if (row.tags && row.tags.length > 0) {
        document.getElementById('sheetTags').textContent = Array.isArray(row.tags) ? row.tags.join(', ') : row.tags;
        tagsRow.style.display = 'flex';
      } else {
        tagsRow.style.display = 'none';
      }

      document.getElementById('sheetOverlay').classList.add('open');
      setTimeout(() => document.getElementById('detailSheet').classList.add('open'), 10);
    }

    function closeDetailModal(e) {
      if (e && e.target !== document.getElementById('sheetOverlay')) return;
      document.getElementById('detailSheet').classList.remove('open');
      document.getElementById('sheetOverlay').classList.remove('open');
    }

    function openEditFromSheet() {
      closeDetailModal();
      if (!currentRow) return;
      document.getElementById('editId').value = currentRow.id;
      document.getElementById('editItem').value = currentRow.item;
      document.getElementById('editAmount').value = currentRow.amount;
      document.getElementById('editCategory').value = currentRow.category;
      document.getElementById('editModal').classList.add('open');
    }

    async function deleteFromSheet() {
      if (!currentRow) return;
      if (!confirm('ยืนยันการลบ "' + currentRow.item + '" ใช่หรือไม่?')) return;
      try {
        const res = await fetch('/api/transaction/' + currentRow.id + '?userId=' + userId, { method: 'DELETE' });
        if (res.ok) window.location.reload();
        else alert('ลบไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ใน Supabase');
      } catch (err) { alert('เกิดข้อผิดพลาด'); }
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.remove('open');
    }

    async function saveEdit() {
      const id = document.getElementById('editId').value;
      const item = document.getElementById('editItem').value;
      const amount = document.getElementById('editAmount').value;
      const category = document.getElementById('editCategory').value;
      try {
        const res = await fetch('/api/transaction/' + id + '?userId=' + userId, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item, amount: Number(amount), category })
        });
        if (res.ok) window.location.reload();
        else alert('แก้ไขไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ใน Supabase');
      } catch (err) { alert('เกิดข้อผิดพลาด'); }
    }
  </script>
</body>
</html>`;
}

module.exports = { renderTransactionsPage };