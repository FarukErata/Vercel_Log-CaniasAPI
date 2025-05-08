const axios = require('axios');
const { Pool } = require('pg');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // 1. Fetch logs from Vercel API
    console.log("Fetching logs from Vercel API");
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const response = await axios.get(`https://api.vercel.com/v2/deployments/${process.env.PROJECT_ID}/events`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        since: oneDayAgo.toISOString(),
        until: now.toISOString()
      }
    });
    
    // 2. Process the logs to find SQL queries
    console.log("Processing logs");
    const logs = response.data.events || [];
    console.log(`Found ${logs.length} total logs`);
    
    const sqlLogs = logs.filter(log => {
      return log.text && log.text.includes('Direct query:');
    });
    console.log(`Found ${sqlLogs.length} SQL logs`);
    
    // Just return the results for now, don't store them
    res.status(200).json({
      message: "Log fetching successful",
      totalLogs: logs.length,
      sqlLogs: sqlLogs.length,
      firstFewSqlLogs: sqlLogs.slice(0, 3) // Just show first 3 for testing
    });
  } catch (error) {
    console.error("Function crashed:", error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};