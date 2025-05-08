// api/log-collector.js
const { collectAndProcessLogs } = require('../log-collector');

module.exports = async (req, res) => {
  const result = await collectAndProcessLogs();
  res.status(200).json(result);
};