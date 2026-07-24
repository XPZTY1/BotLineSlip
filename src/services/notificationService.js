/**
 * Notification Service
 * ใช้ node-cron ส่งข้อความแจ้งเตือนสรุปรายวัน (20:00 น.) และสรุปประจำสัปดาห์ (วันอาทิตย์ 19:00 น.)
 */

const cron = require('node-cron');
const line = require('@line/bot-sdk');
const { config } = require('../config');
const { getAllActiveUserIds, getTransactions } = require('./transactionService');
const { generateFlexSummary } = require('../messages/flexSummary');
const { compareWeeks } = require('./comparisonService');
const { generateWeeklyComparisonFlex } = require('../messages');
const { getBudgets } = require('./budgetService');

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

      if (rows.length === 0) {
        const textMsg = '🌙 สรุปยามเย็น 20:00 น.\nวันนี้คุณยังไม่ได้บันทึกรายการใดๆ เลยครับ อย่าลืมลงบัญชีถ้านึกขึ้นได้นะ!';
        await lineClient.pushMessage({
          to: userId,
          messages: [{ type: 'text', text: textMsg }],
        }).catch(err => console.error(`❌ Push failed for ${userId}:`, err.message));
      } else {
        const flex = generateFlexSummary(rows, 'วันนี้');
        const textMsg = "🌙 สรุปยามเย็น! วันนี้คุณใช้จ่ายไปทั้งหมด:";
        await lineClient.pushMessage({
          to: userId,
          messages: [{ type: 'text', text: textMsg }, flex],
        }).catch(err => console.error(`❌ Push failed for ${userId}:`, err.message));
      }
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

    for (const userId of userIds) {
      if (!userId) continue;
      
      const data = await compareWeeks(userId);
      if (!data) continue;

      const flex = generateWeeklyComparisonFlex(data.thisWeek, data.lastWeek);
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

async function sendMidMonthNotifications() {
  try {
    console.log('⏰ Running mid-month notification cron job (15th 18:00)...');
    const userIds = await getAllActiveUserIds();
    const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
    
    if (now.getUTCDate() !== 15) return;

    const pad = (n) => String(n).padStart(2, '0');
    const dateFrom = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-01`;
    const dateTo = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-15`;

    for (const userId of userIds) {
      if (!userId) continue;
      
      const budgets = await getBudgets(userId);
      if (budgets.length === 0) continue;
      
      const overallBudget = budgets.find((b) => !b.category);
      if (!overallBudget) continue;
      
      const rows = await getTransactions(userId, dateFrom, dateTo);
      const totalExpense = (rows || []).filter(r => r.type === 'รายจ่าย').reduce((sum, r) => sum + Number(r.amount), 0);
      
      const limit = Number(overallBudget.amount);
      const pct = (totalExpense / limit) * 100;
      
      if (pct > 60) {
        const textMsg = `🚨 ครึ่งเดือนแล้ว! คุณใช้เงินไป ${pct.toFixed(0)}% ของงบประมาณ (${totalExpense.toLocaleString()} / ${limit.toLocaleString()} ฿)\nระวังการใช้จ่ายช่วงปลายเดือนด้วยนะครับ!`;
        await lineClient.pushMessage({
          to: userId,
          messages: [{ type: 'text', text: textMsg }],
        }).catch(err => console.error(`❌ Push failed for ${userId}:`, err.message));
      }
    }
  } catch (err) {
    console.error('❌ Mid-month notification error:', err.message);
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

  // กลางเดือน (วันที่ 15) เวลา 18:00 น. (ตามเวลาไทย UTC+7 คือ 11:00 UTC)
  cron.schedule('0 11 15 * *', () => {
    sendMidMonthNotifications();
  });

  console.log('⏰ Notification Scheduler initialized (Daily 20:00, Weekly Sun 19:00, Mid-month 15th 18:00)');
}

module.exports = { initNotificationScheduler };
