const CONFIRM_TTL_MS = 5 * 60 * 1000;
const pendingConfirmations = new Map();

function getPendingEntry(userId) {
  const entry = pendingConfirmations.get(userId);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(userId);
    return null;
  }

  return { transactionData: entry.transactionData, mode: entry.mode || 'confirm' };
}

function getPending(userId) {
  const entry = getPendingEntry(userId);
  return entry ? entry.transactionData : null;
}

function setPending(userId, transactionData, mode = 'confirm') {
  pendingConfirmations.set(userId, {
    transactionData,
    mode,
    expiresAt: Date.now() + CONFIRM_TTL_MS,
  });
}

function clearPending(userId) {
  pendingConfirmations.delete(userId);
}

module.exports = {
  clearPending,
  getPending,
  getPendingEntry,
  setPending,
};