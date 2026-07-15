/**
 * LINE Service
 * รับ event จาก LINE แล้วส่งต่อให้ message handler
 */
const line = require('@line/bot-sdk');
const { config } = require('../config');
const { handleImageMessage, handleTextMessage } = require('../handlers/messageHandler');
const { GENERAL_RESPONSES } = require('../messages');

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});

// Blob client แยกต่างหาก ใช้สำหรับดาวน์โหลดเนื้อหาไฟล์ (รูปภาพ) จาก LINE
const blobClient = new line.messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.line.channelAccessToken,
});

async function handleEvent(event) {
  if (event.type !== 'message') return null;

  const userId = event.source?.userId || null;

  if (event.message.type === 'image') {
    const payload = await handleImageMessage(userId, event.message.id, blobClient);
    return replyPayload(event.replyToken, payload);
  }

  if (event.message.type !== 'text') {
    return replyPayload(event.replyToken, GENERAL_RESPONSES.notText);
  }

  const userMessage = event.message.text.trim();
  const payload = await handleTextMessage(userId, userMessage);

  return replyPayload(event.replyToken, payload);
}

async function replyPayload(replyToken, payload) {
  try {
    const message = typeof payload === 'string' ? { type: 'text', text: payload } : payload;
    return await lineClient.replyMessage({
      replyToken,
      messages: [message],
    });
  } catch (error) {
    if (error.originalError && error.originalError.response) {
      console.error('❌ LINE reply error:', JSON.stringify(error.originalError.response.data, null, 2));
    } else {
      console.error('❌ LINE reply error:', error.message);
    }
    return null;
  }
}

module.exports = {
  handleEvent,
  replyPayload,
};