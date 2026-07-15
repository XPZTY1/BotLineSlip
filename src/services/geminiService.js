/**
 * Gemini AI Service
 * วิเคราะห์ข้อความภาษาไทย → structured JSON
 */
const { GoogleGenAI } = require('@google/genai');
const { config } = require('../config');
const { buildSystemPrompt, buildUserPrompt, buildSlipPrompt } = require('../constants/prompts');
const { getToday, getYesterday, isValidDate, parseDateFromText } = require('../utils/dateParser');
const { ALL_CATEGORIES, categorizeByKeyword, classifyByKeyword } = require('../constants/categories');
const { boostConfidenceForObviousTransaction, isAmbiguousTransactionText } = require('../utils/transactionRules');
const { cleanTransactionItem, extractAmount, parseAmountValue } = require('../utils/moneyParser');

// ─── Initialize Gemini ─────────────────────────────────
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

const GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  temperature: 0.15, // ยัง deterministic แต่ยืดหยุ่นขึ้นเล็กน้อยกับภาษาไทยธรรมชาติ
};

/**
 * ส่งข้อความให้ Gemini AI วิเคราะห์
 * @param {string} userMessage - ข้อความจากผู้ใช้
 * @returns {object} parsed transaction data
 */
async function parseExpenseMessage(userMessage) {
  try {
    const today = getToday();
    const yesterday = getYesterday();

    const systemPrompt = buildSystemPrompt(today, yesterday);
    const userPrompt = buildUserPrompt(userMessage);

    const result = await ai.models.generateContent({
      model: config.gemini.model,
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
      ],
      config: GENERATION_CONFIG,
    });

    const responseText = result.text;
    const parsed = JSON.parse(responseText);

    // ─── Validate & Sanitize ──────────────────────────
    return sanitizeResult(parsed, userMessage);
  } catch (error) {
    console.error('❌ Gemini AI Error:', error.message);

    // Fallback: พยายาม parse เองถ้า Gemini ล้มเหลว
    return fallbackParse(userMessage);
  }
}

/**
 * Validate และ sanitize ผลลัพธ์จาก Gemini
 */
function sanitizeResult(parsed, originalText) {
  const today = getToday();
  const keywordType = classifyByKeyword(originalText);
  const keywordCategory = categorizeByKeyword(originalText, keywordType);
  const parsedDateFromText = parseDateFromText(originalText);

  // Validate amount
  if (parsed.amount !== null && parsed.amount !== undefined) {
    parsed.amount = parseAmountValue(parsed.amount);
    if (parsed.amount === null) {
      parsed.amount = null;
      if (!parsed.missing_fields) parsed.missing_fields = [];
      if (!parsed.missing_fields.includes('amount')) {
        parsed.missing_fields.push('amount');
      }
    }
  } else {
    parsed.amount = extractAmount(originalText);
  }

  // Validate type
  if (!['รายรับ', 'รายจ่าย'].includes(parsed.type)) {
    parsed.type = keywordType;
    parsed.confidence = Math.min(parsed.confidence || 0.5, 0.6);
  }

  // Validate category
  if (!ALL_CATEGORIES.includes(parsed.category)) {
    parsed.category = keywordCategory;
    parsed.confidence = Math.min(parsed.confidence || 0.5, 0.7);
  } else if (keywordCategory !== 'อื่นๆ' && parsed.category === 'อื่นๆ') {
    parsed.category = keywordCategory;
  }

  // Validate date
  if (!parsed.date || !isValidDate(parsed.date)) {
    parsed.date = parsedDateFromText || today;
  }

  // Validate confidence
  if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
    parsed.confidence = 0.7;
  }

  // Ensure missing_fields is array
  if (!Array.isArray(parsed.missing_fields)) {
    parsed.missing_fields = [];
  }

  // ถ้าไม่มี amount ต้องอยู่ใน missing_fields
  if (parsed.amount === null || parsed.amount === undefined) {
    if (!parsed.missing_fields.includes('amount')) {
      parsed.missing_fields.push('amount');
    }
  }

  // ถ้าไม่มี item
  if (!parsed.item || parsed.item.trim() === '') {
    parsed.item = cleanTransactionItem(originalText);
    if (!parsed.missing_fields.includes('item')) {
      parsed.missing_fields.push('item');
    }
  } else {
    parsed.item = String(parsed.item).trim();
  }

  // ถ้าเราเติม item/amount ได้จากข้อความแล้ว ให้เคลียร์ missing field ที่เกี่ยวข้อง
  parsed.missing_fields = parsed.missing_fields.filter((field) => {
    if (field === 'amount') return parsed.amount === null || parsed.amount === undefined;
    if (field === 'item') return !parsed.item;
    if (field === 'type') return !['รายรับ', 'รายจ่าย'].includes(parsed.type);
    if (field === 'category') return !ALL_CATEGORIES.includes(parsed.category);
    return true;
  });

  if (isAmbiguousTransactionText(originalText)) {
    parsed.confidence = Math.min(parsed.confidence, 0.45);
  }

  return boostConfidenceForObviousTransaction(parsed, originalText);
}

/**
 * ส่งรูปสลิปให้ Gemini Vision อ่าน
 * @param {string} base64Image - รูปภาพแบบ base64 (ไม่มี prefix data:image/...)
 * @param {string} mimeType - เช่น 'image/jpeg'
 * @returns {object|null} { amount, date, type, note, confidence } หรือ null ถ้าอ่านล้มเหลว
 */
async function parseSlipImage(base64Image, mimeType = 'image/jpeg') {
  try {
    const slipPrompt = buildSlipPrompt();

    const result = await ai.models.generateContent({
      model: config.gemini.model,
      contents: [
        {
          role: 'user',
          parts: [
            { text: slipPrompt },
            { inlineData: { mimeType, data: base64Image } },
          ],
        },
      ],
      config: GENERATION_CONFIG,
    });

    const responseText = result.text;
    const parsed = JSON.parse(responseText);

    return sanitizeSlipResult(parsed);
  } catch (error) {
    console.error('❌ Gemini Slip Vision Error:', error.message);
    return null;
  }
}

/**
 * Validate ผลลัพธ์การอ่านสลิปจาก Gemini
 */
function sanitizeSlipResult(parsed) {
  const today = getToday();

  const amount = parsed.amount !== null && parsed.amount !== undefined
    ? parseAmountValue(parsed.amount)
    : null;

  const type = ['รายรับ', 'รายจ่าย'].includes(parsed.type) ? parsed.type : 'รายจ่าย';
  const date = parsed.date && isValidDate(parsed.date) ? parsed.date : today;

  const rawNote = parsed.note;
  const note = rawNote && String(rawNote).trim() !== '' && String(rawNote).trim().toLowerCase() !== 'null'
    ? String(rawNote).trim()
    : null;

  const confidence = typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
    ? parsed.confidence
    : 0.7;

  return { amount, date, type, note, confidence };
}

/**
 * Fallback parser เมื่อ Gemini ล้มเหลว
 * พยายาม extract จำนวนเงินและ classify ด้วย keyword
 */
function fallbackParse(text) {
  const today = getToday();

  // ดึงจำนวนเงินจากข้อความ
  const amount = extractAmount(text);

  // ดึงชื่อรายการ (ตัดตัวเลขออก)
  const item = cleanTransactionItem(text);

  // แยกประเภท
  const type = classifyByKeyword(text);

  // จัดหมวด
  const category = categorizeByKeyword(text, type);

  // missing fields
  const missing_fields = [];
  if (amount === null) missing_fields.push('amount');
  if (item === null) missing_fields.push('item');

  return {
    item,
    amount,
    category,
    type,
    date: parseDateFromText(text) || today,
    confidence: isAmbiguousTransactionText(text) ? 0.35 : 0.88,
    missing_fields,
    reply_hint: 'ใช้ fallback parser',
  };
}

module.exports = { parseExpenseMessage, parseSlipImage };