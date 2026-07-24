const express = require('express');
const line = require('@line/bot-sdk');
const { config } = require('./config');
const { handleEvent } = require('./services/lineService');
const { getAllTransactions } = require('./services/transactionService');
const { getGoals } = require('./services/goalService');
const { renderTransactionsPage } = require('./web/transactionsPage');
const { generateTransactionsCsv } = require('./utils/csvHelper');
const { deleteTransactionById, updateTransaction } = require('./services/transactionService');

function createApp() {
  const app = express();

  // LINE SDK verifies the x-line-signature header against the raw request body.
  // Keep this middleware directly on /webhook and do not add express.json() before it.
  const lineMiddleware = line.middleware({
    channelSecret: config.line.channelSecret,
  });

  // ใช้ express.json() สำหรับ API routes (แต่ไม่ใช่ webhook)
  app.use('/api', express.json());

  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      name: 'ManageMoney LINE Bot',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/transactions/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const rows = await getAllTransactions(userId);
      const goals = await getGoals(userId);

      if (rows === null) {
        return res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(renderTransactionsPage(rows, goals));
    } catch (error) {
      console.error('❌ Transactions page error:', error);
      return res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  });

  app.get('/export/csv/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const rows = await getAllTransactions(userId);

      if (rows === null) {
        return res.status(500).send('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
      }

      const csvContent = generateTransactionsCsv(rows);
      const filename = `transactions_${userId}_${Date.now()}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    } catch (error) {
      console.error('❌ CSV export error:', error);
      return res.status(500).send('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  });

  app.delete('/api/transaction/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const result = await deleteTransactionById(id, userId);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.json({ success: true });
    } catch (error) {
      console.error('❌ Delete transaction API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/transaction/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.query;
      const updates = req.body;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      const result = await updateTransaction(id, userId, updates);
      if (!result.success) return res.status(400).json({ error: result.error });
      return res.json({ success: true });
    } catch (error) {
      console.error('❌ Update transaction API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/webhook', lineMiddleware, async (req, res) => {
    try {
      const events = req.body.events || [];

      if (events.length === 0) {
        return res.status(200).json({ status: 'no events' });
      }

      const results = await Promise.allSettled(events.map((event) => handleEvent(event)));
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`❌ Event ${index} failed:`, result.reason);
        }
      });

      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      return res.status(500).json({ status: 'error', message: error.message });
    }
  });

  app.use((err, req, res, next) => {
    if (err instanceof line.SignatureValidationFailed) {
      console.error('❌ LINE Signature Validation Failed');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (err instanceof line.JSONParseError) {
      console.error('❌ JSON Parse Error');
      return res.status(400).json({ error: 'Invalid JSON' });
    }

    console.error('❌ Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };