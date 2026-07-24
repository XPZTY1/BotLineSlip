const { config } = require('../config');
const { parseExpenseMessage, parseSlipImage, parseGoalSettingMessage } = require('../services/geminiService');
const { appendTransaction, deleteLastTransaction, getAllTransactions, getTransactions, getTransactionsByTag, registerActiveUser } = require('../services/transactionService');
const { compareMonths } = require('../services/comparisonService');
const { createGoal, getGoals, addSavingsToGoal, cancelGoal } = require('../services/goalService');
const { checkBudgetWarning, getBudgets, setBudget } = require('../services/budgetService');
const { buildCoachInsights } = require('../services/coachService');
const { generatePdfBuffer, uploadPdfToSupabase } = require('../services/pdfService');
const { renderPdfHtml } = require('../web/pdfTemplate');
const { categorizeByKeyword } = require('../constants/categories');
const { extractTags, cleanTextRemoveTags } = require('../utils/tagParser');
const {
  GENERAL_RESPONSES,
  formatAmount,
  generateBudgetProgressFlex,
  generateCoachFlex,
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
  isBudgetCheckRequest,
  isBudgetSettingRequest,
  isCoachRequest,
  isComparisonRequest,
  isCsvRequest,
  isDeleteLastRequest,
  isGoalSettingRequest,
  isGoalProgressRequest,
  isGoalCancelRequest,
  isGreeting,
  isHelpRequest,
  isPdfRequest,
  isTagSummaryRequest,
  parsePdfMonth,
  parseSummaryPeriod,
} = require('../messages');
const { shouldAutoSaveTransaction } = require('../utils/transactionRules');
const { clearPending, getPendingEntry, setPending } = require('../state/pendingConfirmations');

const CONFIRM_YES = ['ใช่', 'yes', 'ใช่ครับ', 'ใช่ค่ะ', 'ตกลง', 'ok', 'โอเค', 'ได้', 'บันทึก', 'ถูก', 'ถูกต้อง', '✅', '👍'];
const CONFIRM_NO = ['ไม่', 'no', 'ไม่ใช่', 'ไม่ถูก', 'ผิด', 'ยกเลิก', 'cancel', '❌', '👎'];

async function handleTextMessage(userId, userMessage) {
  if (userId) registerActiveUser(userId);

  // ตรวจสอบคำสั่งลบก่อน เพื่อให้ปุ่มลบทำงานได้แม้มี pending state ค้างอยู่
  if (isDeleteLastRequest(userMessage)) {
    if (userId) clearPending(userId);
    const result = await deleteLastTransaction(userId);
    if (!result.success) {
      return `❌ ไม่สามารถลบรายการได้: ${result.error}`;
    }
    const { item, amount, category } = result.deleted;
    return `🗑️ ลบรายการล่าสุดเรียบร้อยแล้วครับ!\n• รายการ: ${item}\n• หมวด: ${category}\n• จำนวน: ${formatAmount(amount)} ฿`;
  }

  const pendingReply = await handlePendingConfirmation(userId, userMessage);
  if (pendingReply) return pendingReply;

  if (isGreeting(userMessage)) {
    return GENERAL_RESPONSES.greeting;
  }

  if (isHelpRequest(userMessage)) {
    return GENERAL_RESPONSES.help;
  }

  if (isBudgetSettingRequest(userMessage)) {
    return buildBudgetSettingReply(userId, userMessage);
  }

  if (isBudgetCheckRequest(userMessage)) {
    return buildBudgetProgressReply(userId);
  }

  if (isCoachRequest(userMessage)) {
    const coachResult = await buildCoachInsights(userId);
    if (!coachResult.success) return coachResult.message;
    return generateCoachFlex(coachResult.data);
  }

  if (isCsvRequest(userMessage)) {
    if (!userId) return GENERAL_RESPONSES.error;
    const csvUrl = `${config.baseUrl}/export/csv/${userId}`;
    return `📊 ดาวน์โหลดไฟล์ CSV สำหรับเปิดใน Excel หรือ Google Sheets ได้ที่นี่ครับ:\n\n⬇️ ${csvUrl}`;
  }

  if (isTagSummaryRequest(userMessage)) {
    return buildTagSummaryReply(userId, userMessage);
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

  if (isGoalCancelRequest(userMessage)) {
    const goals = await getGoals(userId);
    if (!goals || goals.length === 0) {
      return 'คุณไม่มีเป้าหมายที่กำลังทำงานอยู่ครับ';
    }
    setPending(userId, {}, 'awaiting_goal_cancellation');
    return generateGoalCancellationQuickReply(goals);
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

    // สกัด #แฮชแท็ก จากข้อความ
    const tags = extractTags(userMessage);
    const cleanMessage = cleanTextRemoveTags(userMessage);

    const parsed = await parseExpenseMessage(cleanMessage || userMessage);
    if (tags.length > 0) {
      parsed.tags = tags;
    }
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
  if (userId) registerActiveUser(userId);
  try {
    const imageBuffer = await downloadImageContent(blobClient, messageId);
    const base64Image = imageBuffer.toString('base64');
    const slip = await parseSlipImage(base64Image, 'image/jpeg');

    if (!slip || slip.amount === null || slip.amount === undefined) {
      return 'อ่านสลิปไม่ออกครับ ลองส่งรูปที่ชัดกว่านี้ หรือพิมพ์รายการเองก็ได้ครับ เช่น "ค่าอาหาร 150"';
    }

    // มีหมายเหตุในสลิปอยู่แล้ว หรือมี autoCategory → บันทึกทันที
    if (slip.note || slip.autoCategory) {
      const itemText = slip.note || (slip.bank ? `ชำระเงิน (${slip.bank})` : 'รายการสลิปโอนเงิน');
      const category = slip.autoCategory || categorizeByKeyword(itemText, slip.type);
      const transactionData = {
        item: itemText,
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

    return `อ่านสลิป${slip.bank ? ` (${slip.bank})` : ''} ได้แล้วครับ ยอด ${formatAmount(slip.amount)} ฿ แต่ในสลิปไม่มีหมายเหตุ\nรายการนี้ทำอะไรครับ (พิมพ์สั้น ๆ ได้เลย เช่น "ค่าอาหาร" หรือ "ค่าเช่าบ้าน")`;
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

  if (pendingEntry.mode === 'awaiting_goal_cancellation') {
    clearPending(userId);
    if (userMessage === 'cancel_cancel') {
      return 'โอเคครับ ไม่ยกเลิกเป้าหมายแล้ว';
    }
    
    const goalId = userMessage.trim();
    const result = await cancelGoal(goalId);
    if (!result.success) {
      return 'เกิดข้อผิดพลาดในการยกเลิกเป้าหมายครับ';
    }
    
    return `ยกเลิกเป้าหมาย "${result.goal.name}" เรียบร้อยแล้วครับ ❌`;
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

    const [rows, goals] = await Promise.all([
      getTransactions(userId, dateFrom, dateTo),
      getGoals(userId),
    ]);
    if (rows === null) return GENERAL_RESPONSES.error;

    return generateFlexSummary(rows, label, goals) || GENERAL_RESPONSES.noData;
  } catch (error) {
    console.error('❌ Analysis error:', error);
    return GENERAL_RESPONSES.error;
  }
}

async function buildBalanceReply(userId) {
  try {
    const [rows, goals] = await Promise.all([
      getAllTransactions(userId),
      getGoals(userId),
    ]);
    if (rows === null) return GENERAL_RESPONSES.error;

    return generateFlexSummary(rows, 'ทั้งหมด', goals) || GENERAL_RESPONSES.noData;
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

function generateGoalCancellationQuickReply(goals) {
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
      label: 'ไม่ยกเลิกแล้ว',
      text: 'cancel_cancel'
    }
  });

  return {
    type: 'text',
    text: `คุณต้องการยกเลิกเป้าหมายไหนครับ? ❌\n(เงินที่เคยออมไปแล้วจะยังอยู่ในระบบรายจ่ายปกติ)`,
    quickReply: { items }
  };
}

async function buildBudgetSettingReply(userId, userMessage) {
  const m = userMessage.match(/(\d[\d,]*)/);
  if (!m) {
    return 'กรุณาระบุจำนวนเงินงบประมาณด้วยครับ เช่น "ตั้งงบ 15000"';
  }
  const amount = parseFloat(m[1].replace(/,/g, ''));
  const result = await setBudget(userId, amount);

  if (!result.success) return GENERAL_RESPONSES.error;
  return `🎯 ตั้งงบประมาณเดือนนี้เรียบร้อยแล้วครับ: ${formatAmount(amount)} บาท\nระบบจะคอยแจ้งเตือนเมื่อใช้จ่ายใกล้ถึง 80% หรือเกินงบนะครับ!`;
}

async function buildBudgetProgressReply(userId) {
  const budgets = await getBudgets(userId);
  if (!budgets || budgets.length === 0) {
    return 'คุณยังไม่ได้ตั้งงบประมาณประจำเดือนเลยครับ ลองพิมพ์ "ตั้งงบ 15000" เพื่อตั้งงบดูได้เลย!';
  }

  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const dateFrom = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
  const dateTo = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate())}`;

  const rows = await getTransactions(userId, dateFrom, dateTo);
  const currentExpenseTotal = (rows || []).filter(r => r.type === 'รายจ่าย').reduce((s, r) => s + Number(r.amount), 0);

  return generateBudgetProgressFlex(budgets, currentExpenseTotal);
}

async function buildTagSummaryReply(userId, userMessage) {
  const tagMatch = userMessage.match(/#[^\s#]+/);
  const tag = tagMatch ? tagMatch[0] : null;

  const rows = await getTransactionsByTag(userId, tag);
  if (!rows || rows.length === 0) {
    return `ไม่พบบันทึกรายการสำหรับแท็ก ${tag || ''} ครับ`;
  }

  const totalExpense = rows.filter(r => r.type === 'รายจ่าย').reduce((s, r) => s + Number(r.amount), 0);
  const totalIncome = rows.filter(r => r.type === 'รายรับ').reduce((s, r) => s + Number(r.amount), 0);

  return `🏷️ สรุปรายการสำหรับแท็ก ${tag || ''}\n• รายจ่ายรวม: ${formatAmount(totalExpense)} ฿\n• รายรับรวม: ${formatAmount(totalIncome)} ฿\n• รายการทั้งหมด: ${rows.length} รายการ`;
}

async function saveAndBuildReply(transactionData, userId) {
  const result = await appendTransaction(transactionData, userId);
  if (result.success) {
    const flex = generateTransactionFlex(transactionData);

    // เช็คเตือนงบประมาณเมื่อบันทึกรายจ่าย
    if (transactionData.type === 'รายจ่าย' && userId) {
      const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, '0');
      const dateFrom = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
      const dateTo = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate())}`;

      const rows = await getTransactions(userId, dateFrom, dateTo);
      const warningText = await checkBudgetWarning(userId, rows);

      if (warningText) {
        return [flex, { type: 'text', text: warningText }];
      }
    }

    return flex;
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
    tags: parsed.tags || [],
  };
}

module.exports = {
  handleImageMessage,
  handleTextMessage,
};