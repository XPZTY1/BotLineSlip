const { generateFlexComparison } = require('./flexComparison');
const { generateGoalCreatedFlex, generateGoalsProgressFlex } = require('./flexGoal');

module.exports = {
  ...require('./textReplies'),
  ...require('./flexTransaction'),
  ...require('./flexSummary'),
  ...require('./flexTransactionList'),
  generateFlexComparison,
  generateGoalCreatedFlex,
  generateGoalsProgressFlex,
};