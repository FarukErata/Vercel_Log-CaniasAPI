const axios = require('axios');
const { createClient } = require('@vercel/postgres');

// Core function to collect and process logs
async function collectAndProcessLogs() {
  try {
    // 1. Fetch logs from Vercel API
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    
    const response = await axios.get(`https://api.vercel.com/v2/deployments/${process.env.PROJECT_ID}/events`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        since: oneHourAgo.toISOString(),
        until: now.toISOString()
      }
    });
    
    // 2. Process the logs to find SQL queries
    const logs = response.data.events || [];
    const sqlLogs = logs.filter(log => {
      return log.text && log.text.includes('Direct query:');
    });
    
    // 3. Store SQL logs in Vercel Postgres
    if (sqlLogs.length > 0) {
      const client = createClient();
      await client.connect();
      
      // Create table if it doesn't exist
      await client.sql`
        CREATE TABLE IF NOT EXISTS sql_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP,
          query TEXT,
          log_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      // Insert logs
      for (const log of sqlLogs) {
        const queryMatch = log.text.match(/Direct query: (.*)/);
        const sqlQuery = queryMatch ? queryMatch[1] : '';
        
        await client.sql`
          INSERT INTO sql_logs (timestamp, query, log_data)
          VALUES (${new Date(log.timestamp).toISOString()}, ${sqlQuery}, ${JSON.stringify(log)})
        `;
      }
      
      await client.end();
      
      console.log(`Stored ${sqlLogs.length} SQL logs in database`);
    } else {
      console.log('No SQL logs found in this time period');
    }
    
    return { success: true, logsProcessed: sqlLogs.length };
  } catch (error) {
    console.error('Error collecting logs:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { collectAndProcessLogs };