const { generateFlexComparison } = require('./flexComparison');
const { generateGoalCreatedFlex, generateGoalsProgressFlex } = require('./flexGoal');
const { generateCoachFlex } = require('./flexCoach');
const { generateBudgetProgressFlex } = require('./flexBudget');

module.exports = {
  ...require('./textReplies'),
  ...require('./flexTransaction'),
  ...require('./flexSummary'),
  ...require('./flexTransactionList'),
  generateFlexComparison,
  generateGoalCreatedFlex,
  generateGoalsProgressFlex,
  generateCoachFlex,
  generateBudgetProgressFlex,
};