const { config } = require('../config');
const { parseExpenseMessage, parseSlipImage, parseGoalSettingMessage } = require('../services/geminiService');
const { appendTransaction, getAllTransactions, getTransactions } = require('../services/transactionService');
const { compareMonths } = require('../services/comparisonService');
const { createGoal, getGoals, addSavingsToGoal } = require('../services/goalService');
const { generatePdfBuffer, uploadPdfToSupabase } = require('../services/pdfService');
const { renderPdfHtml } = require('../web/pdfTemplate');
const { categorizeByKeyword } = require('../constants/categories');
const {
  GENERAL_RESPONSES,
  formatAmount,
  generateConfirmQuickReply,
  generateFlexSummary,
  generateFlexComparison,
  generateGoalCreatedFlex,
  generateGoalsProgressFlex,
  generateMissingFieldReply,
  generateTransactionFlex,
  generateTransactionsLinkFlex,
  isAllTransactionsRequest,
  isAnalysisRequest,
  isBalanceRequest,
  isComparisonRequest,
  isGoalSettingRequest,
  isGoalProgressRequest,
  isGreeting,
  isHelpRequest,
  isPdfRequest,
  parsePdfMonth,
  parseSummaryPeriod,
} = require('../messages');
const { shouldAutoSaveTransaction } = require('../utils/transactionRules');
const { clearPending, getPendingEntry, setPending } = require('../state/pendingConfirmations');

const CONFIRM_YES = ['ใช่', 'yes', 'ใช่ครับ', 'ใช่ค่ะ', 'ตกลง', 'ok', 'โอเค', 'ได้', 'บันทึก', 'ถูก', 'ถูกต้อง', '✅', '👍'];
const CONFIRM_NO = ['ไม่', 'no', 'ไม่ใช่', 'ไม่ถูก', 'ผิด', 'ยกเลิก', 'cancel', '❌', '👎'];

async function handleTextMessage(userId, userMessage) {
  const pendingReply = await handlePendingConfirmation(userId, userMessage);
  if (pendingReply) return pendingReply;

  if (isGreeting(userMessage)) {
    return GENERAL_RESPONSES.greeting;
  }

  if (isHelpRequest(userMessage)) {
    return GENERAL_RESPONSES.help;
  }

  if (isBalanceRequest(userMessage)) {
    return buildBalanceReply(userId);
  }

  if (isAllTransactionsRequest(userMessage)) {
    return buildAllTransactionsReply(userId);
  }

  if (isComparisonRequest(userMessage)) {
    return buildComparisonReply(userId);
  }

  if (isGoalSettingRequest(userMessage)) {
    return buildGoalSettingReply(userId, userMessage);
  }

  if (isGoalProgressRequest(userMessage)) {
    return buildGoalProgressReply(userId);
  }

  if (isPdfRequest(userMessage)) {
    return buildPdfReply(userId, userMessage);
  }

  if (isAnalysisRequest(userMessage)) {
    return buildSummaryReply(userId, userMessage);
  }

  if (userMessage.length < 2) {
    return GENERAL_RESPONSES.help;
  }

  try {
    console.log(`📩 [${userId || 'unknown'}] "${userMessage}"`);
    const parsed = await parseExpenseMessage(userMessage);
    console.log('🤖 Gemini:', JSON.stringify(parsed));

    if (parsed.missing_fields && parsed.missing_fields.length > 0) {
      return generateMissingFieldReply(parsed.missing_fields, parsed);
    }

    const transactionData = toTransactionData(parsed);

    if (transactionData.category === 'เงินออม' && userId) {
      const goals = await getGoals(userId);
      if (goals && goals.length > 0) {
        setPending(userId, transactionData, 'awaiting_goal_selection');
        return generateGoalSelectionQuickReply(goals, transactionData.amount);
      }
    }

    if (shouldAutoSaveTransaction(parsed, userMessage)) {
      return saveAndBuildReply(transactionData, userId);
    }

    if (userId) {
      setPending(userId, transactionData);
    }

    return generateConfirmQuickReply(transactionData);
  } catch (error) {
    console.error('❌ Error handling message:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function handleImageMessage(userId, messageId, blobClient) {
  try {
    const imageBuffer = await downloadImageContent(blobClient, messageId);
    const base64Image = imageBuffer.toString('base64');
    const slip = await parseSlipImage(base64Image, 'image/jpeg');

    if (!slip || slip.amount === null || slip.amount === undefined) {
      return 'อ่านสลิปไม่ออกครับ ลองส่งรูปที่ชัดกว่านี้ หรือพิมพ์รายการเองก็ได้ครับ เช่น "ค่าอาหาร 150"';
    }

    // มีหมายเหตุในสลิปอยู่แล้ว → บันทึกทันที
    if (slip.note) {
      const category = categorizeByKeyword(slip.note, slip.type);
      const transactionData = {
        item: slip.note,
        amount: slip.amount,
        category,
        type: slip.type,
        date: slip.date,
      };
      return saveAndBuildReply(transactionData, userId);
    }

    // ไม่มีหมายเหตุ → ถามผู้ใช้ว่าทำรายการนี้เพื่ออะไร แล้วรอคำตอบ
    if (userId) {
      setPending(userId, { amount: slip.amount, type: slip.type, date: slip.date }, 'awaiting_item');
    }

    return `อ่านสลิปได้แล้วครับ ยอด ${formatAmount(slip.amount)} ฿ แต่ในสลิปไม่มีหมายเหตุ\nรายการนี้ทำอะไรครับ (พิมพ์สั้น ๆ ได้เลย เช่น "ค่าอาหาร" หรือ "ค่าเช่าบ้าน")`;
  } catch (error) {
    console.error('❌ Slip image error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function downloadImageContent(blobClient, messageId) {
  const stream = await blobClient.getMessageContent(messageId);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handlePendingConfirmation(userId, userMessage) {
  if (!userId) return null;

  const pendingEntry = getPendingEntry(userId);
  if (!pendingEntry) return null;

  if (pendingEntry.mode === 'awaiting_item') {
    clearPending(userId);
    const item = userMessage.trim();
    const { amount, type, date } = pendingEntry.transactionData;
    const category = categorizeByKeyword(item, type);
    const transactionData = { item, amount, category, type, date };
    return saveAndBuildReply(transactionData, userId);
  }

  if (pendingEntry.mode === 'awaiting_pdf_month') {
    const month = parsePdfMonth(userMessage);
    if (!month) {
      return 'ยังไม่เข้าใจว่าเดือนไหนครับ ลองพิมพ์อีกที (เช่น "กรกฎา", "เดือน 7", "เดือนนี้")';
    }
    clearPending(userId);
    return buildPdfReplyWithMonth(userId, month);
  }

  if (pendingEntry.mode === 'awaiting_goal_selection') {
    clearPending(userId);
    const { amount } = pendingEntry.transactionData;
    
    if (userMessage === 'skip_goal') {
      return saveAndBuildReply(pendingEntry.transactionData, userId);
    }
    
    const goalId = userMessage.trim();
    const result = await addSavingsToGoal(goalId, amount);
    if (!result.success) {
      return saveAndBuildReply(pendingEntry.transactionData, userId);
    }
    
    await appendTransaction(pendingEntry.transactionData, userId);
    return `หยอดกระปุก ${amount} ฿ เข้าเป้าหมาย "${result.goal.name}" เรียบร้อยแล้วครับ! 🎯\nตอนนี้เก็บได้ ${result.goal.current_amount} / ${result.goal.target_amount} ฿`;
  }

  const pendingData = pendingEntry.transactionData;
  const normalizedMessage = userMessage.toLowerCase().trim();

  if (CONFIRM_YES.some((word) => normalizedMessage === word)) {
    clearPending(userId);
    return saveAndBuildReply(pendingData, userId);
  }

  if (CONFIRM_NO.some((word) => normalizedMessage === word)) {
    clearPending(userId);
    return 'ยกเลิกแล้วครับ ถ้าจะบันทึกใหม่ พิมพ์รายการมาได้เลย';
  }

  clearPending(userId);
  return null;
}

async function buildSummaryReply(userId, userMessage) {
  try {
    const { dateFrom, dateTo, label } = parseSummaryPeriod(userMessage);
    console.log(`📊 วิเคราะห์ ${label}: ${dateFrom} → ${dateTo}`);

    const rows = await getTransactions(userId, dateFrom, dateTo);
    if (rows === null) return GENERAL_RESPONSES.error;

    return generateFlexSummary(rows, label) || GENERAL_RESPONSES.noData;
  } catch (error) {
    console.error('❌ Analysis error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function buildBalanceReply(userId) {
  try {
    const rows = await getAllTransactions(userId);
    if (rows === null) return GENERAL_RESPONSES.error;

    return generateFlexSummary(rows, 'ทั้งหมด') || GENERAL_RESPONSES.noData;
  } catch (error) {
    console.error('❌ Balance error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function buildAllTransactionsReply(userId) {
  if (!userId) return GENERAL_RESPONSES.error;

  const url = `${config.baseUrl}/transactions/${userId}`;
  return generateTransactionsLinkFlex(url);
}

async function buildComparisonReply(userId) {
  try {
    console.log(`📊 [comparison] userId: ${userId}`);
    const data = await compareMonths(userId);
    if (data === null) return GENERAL_RESPONSES.error;

    const flex = generateFlexComparison(data);
    if (!flex) return GENERAL_RESPONSES.noData;

    return flex;
  } catch (error) {
    console.error('❌ Comparison error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function buildPdfReply(userId, userMessage) {
  const month = parsePdfMonth(userMessage);
  if (!month) {
    setPending(userId, {}, 'awaiting_pdf_month');
    return '📄 สร้าง PDF สรุปรายการได้เลยครับ\nจะเอาเดือนไหน? พิมพ์ได้เลย เช่น\n• เดือนนี้\n• มิถุนา / กรกฎา\n• เดือน 6 / เดือน 7';
  }
  return buildPdfReplyWithMonth(userId, month);
}

async function buildPdfReplyWithMonth(userId, month) {
  try {
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const year = now.getUTCFullYear();
    const targetYear = month > now.getUTCMonth() + 1 ? year - 1 : year;
    const lastDay = new Date(targetYear, month, 0).getDate();
    
    const pad = (n) => String(n).padStart(2, '0');
    const dateFrom = `${targetYear}-${pad(month)}-01`;
    const dateTo = `${targetYear}-${pad(month)}-${pad(lastDay)}`;
    
    const monthNames = [
      '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const label = `${monthNames[month]} ${targetYear + 543}`;
    
    console.log(`📄 [PDF] userId: ${userId}, month: ${month}, ${dateFrom} -> ${dateTo}`);
    
    const rows = await getTransactions(userId, dateFrom, dateTo);
    if (rows === null) return GENERAL_RESPONSES.error;
    if (rows.length === 0) return `ไม่มีรายการในเดือน${label} ให้สรุปครับ 📭`;

    const htmlString = renderPdfHtml(rows, label, dateFrom, dateTo);
    const pdfBuffer = await generatePdfBuffer(htmlString);
    
    const filename = `summary_${userId}_${targetYear}${pad(month)}_${Date.now()}.pdf`;
    const publicUrl = await uploadPdfToSupabase(pdfBuffer, filename);
    
    return `📄 PDF พร้อมแล้วครับ!\nสรุปรายการ ${label}\nรายการทั้งหมด ${rows.length} รายการ\n\n⬇️ ดาวน์โหลด PDF\n${publicUrl}`;
  } catch (error) {
    console.error('❌ PDF export error:', error);
    return 'ขออภัยครับ เกิดข้อผิดพลาดในการสร้าง PDF ลองใหม่อีกครั้งนะครับ 🙏';
  }
}

async function buildGoalSettingReply(userId, userMessage) {
  const parsed = await parseGoalSettingMessage(userMessage);
  if (!parsed || !parsed.name || !parsed.target_amount || !parsed.duration_months) {
    return 'ไม่สามารถตั้งเป้าหมายได้ครับ ช่วยบอกใหม่ให้ชัดเจนขึ้นหน่อย เช่น "ออมเงินซื้อไอแพด 30,000 บาท ภายใน 10 เดือน"';
  }
  
  const result = await createGoal(userId, parsed.name, parsed.target_amount, parsed.duration_months);
  if (!result.success) return GENERAL_RESPONSES.error;
  
  return generateGoalCreatedFlex(result.goal);
}

async function buildGoalProgressReply(userId) {
  const goals = await getGoals(userId);
  if (!goals) return GENERAL_RESPONSES.error;
  if (goals.length === 0) return 'คุณยังไม่มีเป้าหมายการออมเลยครับ ลองตั้งดูไหม? เช่น "ออมเงินซื้อโทรศัพท์ 20,000 บาท ภายใน 6 เดือน"';
  
  return generateGoalsProgressFlex(goals);
}

function generateGoalSelectionQuickReply(goals, amount) {
  const items = goals.slice(0, 10).map(goal => ({
    type: 'action',
    action: {
      type: 'message',
      label: goal.name.substring(0, 20),
      text: goal.id
    }
  }));
  
  items.push({
    type: 'action',
    action: {
      type: 'message',
      label: 'ไม่ระบุ',
      text: 'skip_goal'
    }
  });

  return {
    type: 'text',
    text: `ต้องการหยอดกระปุก ${amount} บาท เข้าเป้าหมายไหนครับ? 🎯`,
    quickReply: { items }
  };
}

async function saveAndBuildReply(transactionData, userId) {
  const result = await appendTransaction(transactionData, userId);
  if (result.success) {
    return generateTransactionFlex(transactionData);
  }

  console.error('❌ บันทึกไม่สำเร็จ:', result.error);
  return GENERAL_RESPONSES.error;
}

function toTransactionData(parsed) {
  return {
    item: parsed.item,
    amount: parsed.amount,
    category: parsed.category,
    type: parsed.type,
    date: parsed.date,
  };
}

module.exports = {
  handleImageMessage,
  handleTextMessage,
};