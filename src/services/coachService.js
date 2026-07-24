/**
 * AI Financial Coach Service
 * วิเคราะห์พฤติกรรมการใช้จ่ายของผู้ใช้ และสังเคราะห์ข้อแนะนำการเงิน
 */

const { getTransactions } = require('./transactionService');
const { generateCoachAnalysis } = require('./geminiService');

function getThaiMonthName(month) {
  const months = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[month] || '';
}

async function buildCoachInsights(userId) {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const pad = (n) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();

  const dateFrom = `${year}-${pad(month)}-01`;
  const dateTo = `${year}-${pad(month)}-${pad(lastDay)}`;
  const monthLabel = `${getThaiMonthName(month)} ${year + 543}`;

  const rows = await getTransactions(userId, dateFrom, dateTo);

  if (!rows || rows.length === 0) {
    return {
      success: false,
      message: `ยังไม่มีรายการบันทึกในเดือน${monthLabel} เลยครับ ลองบันทึกรายการบ้าง แล้วค่อยเรียกโค้ชการเงินใหม่นะครับ 🤖`
    };
  }

  const incomeTotal = rows.filter(r => r.type === 'รายรับ').reduce((s, r) => s + Number(r.amount), 0);
  const expenseTotal = rows.filter(r => r.type === 'รายจ่าย').reduce((s, r) => s + Number(r.amount), 0);

  const summaryText = `เดือน: ${monthLabel}, รายรับรวม: ${incomeTotal} บาท, รายจ่ายรวม: ${expenseTotal} บาท, จำนวนรายการ: ${rows.length} รายการ`;

  const top10 = rows.slice(0, 15).map(r => `${r.date} | ${r.type} | ${r.item} | ${r.category} | ${r.amount}฿`).join('\n');

  const coachResult = await generateCoachAnalysis(summaryText, top10);

  if (!coachResult) {
    return {
      success: false,
      message: 'ขออภัยครับ โค้ชการเงินติดขัดชั่วคราว ลองเรียกใหม่อีกครั้งนะครับ'
    };
  }

  return {
    success: true,
    data: {
      monthLabel,
      incomeTotal,
      expenseTotal,
      ...coachResult
    }
  };
}

module.exports = { buildCoachInsights };
