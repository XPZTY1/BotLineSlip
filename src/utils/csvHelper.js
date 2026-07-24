/**
 * CSV Export Helper
 * แปลง array ของธุรกรรมเป็น CSV String ที่มี UTF-8 BOM
 * เพื่อรองรับภาษาไทยใน Microsoft Excel และ Google Sheets
 */

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function generateTransactionsCsv(rows) {
  const headers = ['วันที่', 'รายการ', 'หมวดหมู่', 'ประเภท', 'จำนวนเงิน (บาท)', 'แท็ก'];
  const lines = [headers.map(escapeCsvField).join(',')];

  (rows || []).forEach((row) => {
    const tagsStr = Array.isArray(row.tags) ? row.tags.join(' ') : (row.tags || '');
    const line = [
      escapeCsvField(row.date),
      escapeCsvField(row.item),
      escapeCsvField(row.category),
      escapeCsvField(row.type),
      escapeCsvField(row.amount),
      escapeCsvField(tagsStr),
    ].join(',');
    lines.push(line);
  });

  // \uFEFF คือ UTF-8 BOM ช่วยให้ Excel แสดงผลภาษาไทยถูกต้อง
  return '\uFEFF' + lines.join('\r\n');
}

module.exports = { generateTransactionsCsv };
