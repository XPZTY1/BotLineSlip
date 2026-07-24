/**
 * Notification Service
 * ใช้ node-cron ส่งข้อความแจ้งเตือนสรุปรายวัน (20:00 น.) และสรุปประจำสัปดาห์ (วันอาทิตย์ 19:00 น.)
 */

const cron = require('node-cron');
const line = require('@line/bot-sdk');
const { config } = require('../config');
const { getAllActiveUserIds, getTransactions } = require('./transactionService');
const { generateFlexSummary } = require('../messages/flexSummary');

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.line.channelAccessToken,
});

function getTodayFmt() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
}

async function sendDailyNotifications() {
  try {
    console.log('⏰ Running daily notification cron job (20:00)...');
    const userIds = await getAllActiveUserIds();
    const today = getTodayFmt();

    for (const userId of userIds) {
      if (!userId) continue;
      const rows = await getTransactions(userId, today, today);
      if (!rows) continue;

      const totalExpense = rows.filter(r => r.type === 'รายจ่าย').reduce((s, r) => s + Number(r.amount), 0);
      const totalIncome = rows.filter(r => r.type === 'รายรับ').reduce((s, r) => s + Number(r.amount), 0);

      let textMsg = '';
      if (rows.length === 0) {
        textMsg = '🌙 สรุปยามเย็น 20:00 น.\nวันนี้คุณยังไม่ได้บันทึกรายการใดๆ เลยครับ อย่าลืมลงบัญชีถ้านึกขึ้นได้นะ!';
      } else {
        textMsg = `🌙 สรุปยอดใช้งานวันนี้ (${today})\n• รายรับ: +${totalIncome.toLocaleString()} ฿\n• รายจ่าย: -${totalExpense.toLocaleString()} ฿\n(รวมทั้งหมด ${rows.length} รายการ)\n\nเก่งมากครับที่บันทึกบัญชีสม่ำเสมอ! 👏`;
      }

      await lineClient.pushMessage({
        to: userId,
        messages: [{ type: 'text', text: textMsg }],
      }).catch(err => console.error(`❌ Push failed for ${userId}:`, err.message));
    }
  } catch (err) {
    console.error('❌ Daily notification error:', err.message);
  }
}

async function sendWeeklyNotifications() {
  try {
    console.log('⏰ Running weekly notification cron job (Sunday 19:00)...');
    const userIds = await getAllActiveUserIds();
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday

    if (dayOfWeek !== 0) return;

    const pad = (n) => String(n).padStart(2, '0');
    const dateTo = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
    
    // ย้อนหลัง 6 วันรวมวันนี้เป็น 7 วัน
    const past7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const dateFrom = `${past7.getUTCFullYear()}-${pad(past7.getUTCMonth() + 1)}-${pad(past7.getUTCDate())}`;

    for (const userId of userIds) {
      if (!userId) continue;
      const rows = await getTransactions(userId, dateFrom, dateTo);
      if (!rows || rows.length === 0) continue;

      const flex = generateFlexSummary(rows, 'สัปดาห์นี้');
      if (flex) {
        await lineClient.pushMessage({
          to: userId,
          messages: [{ type: 'text', text: '📅 สรุปรายรับรายจ่ายประจำสัปดาห์นี้ครับ!' }, flex],
        }).catch(err => console.error(`❌ Push failed for ${userId}:`, err.message));
      }
    }
  } catch (err) {
    console.error('❌ Weekly notification error:', err.message);
  }
}

function initNotificationScheduler() {
  // ทุกวัน เวลา 20:00 น. (ตามเวลาไทย UTC+7 คือ 13:00 UTC)
  cron.schedule('0 13 * * *', () => {
    sendDailyNotifications();
  });

  // ทุกวันอาทิตย์ เวลา 19:00 น. (ตามเวลาไทย UTC+7 คือ 12:00 UTC)
  cron.schedule('0 12 * * 0', () => {
    sendWeeklyNotifications();
  });

  console.log('⏰ Notification Scheduler initialized (Daily 20:00, Weekly Sun 19:00)');
}

module.exports = { initNotificationScheduler };
