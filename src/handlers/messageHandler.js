const { config } = require('../config');
const { parseExpenseMessage, parseSlipImage } = require('../services/geminiService');
const { appendTransaction, getAllTransactions, getTransactions } = require('../services/transactionService');
const { categorizeByKeyword } = require('../constants/categories');
const {
  GENERAL_RESPONSES,
  formatAmount,
  generateConfirmQuickReply,
  generateFlexSummary,
  generateMissingFieldReply,
  generateTransactionFlex,
  generateTransactionsLinkFlex,
  isAllTransactionsRequest,
  isAnalysisRequest,
  isBalanceRequest,
  isGreeting,
  isHelpRequest,
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