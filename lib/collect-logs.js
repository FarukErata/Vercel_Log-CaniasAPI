const axios = require('axios');
const { Pool } = require('pg'); // Change to use standard pg package

// Core function to collect and process logs
async function collectAndProcessLogs() {
  try {
    // 1. Fetch logs from Vercel API
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const response = await axios.get(`https://api.vercel.com/v1/deployments/${process.env.PROJECT_ID}/events`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        since: oneDayAgo.toISOString(),
        until: now.toISOString()
      }
    });
    
    // 2. Process the logs to find SQL queries
    const logs = response.data.events || [];
    const sqlLogs = logs.filter(log => {
      return log.text && log.text.includes('Direct query:');
    });
    
    // 3. Store SQL logs in Neon Postgres
    if (sqlLogs.length > 0) {
      // Connect to Neon DB using connection pooling
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Required for Neon's SSL connections
        }
      });
      
      // Create table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sql_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP,
          query TEXT,
          log_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Insert logs
      for (const log of sqlLogs) {
        const queryMatch = log.text.match(/Direct query: (.*)/);
        const sqlQuery = queryMatch ? queryMatch[1] : '';
        
        await pool.query(
          'INSERT INTO sql_logs (timestamp, query, log_data) VALUES ($1, $2, $3)',
          [new Date(log.timestamp), sqlQuery, JSON.stringify(log)]
        );
      }
      
      // Close the connection pool
      await pool.end();
      
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