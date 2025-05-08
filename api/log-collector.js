const axios = require('axios');
const { Pool } = require('pg');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // 1. First get deployments for the project
    console.log("Fetching deployments");
    const deploymentsResponse = await axios.get("https://api.vercel.com/v1/deployments", {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        projectId: process.env.PROJECT_ID,
        limit: 5 // Get the 5 most recent deployments
      }
    });
    console.log(`Found ${PROJECT_ID} PROPJECT`)
    
    const deployments = deploymentsResponse.data.deployments || [];
    console.log(`Found ${deployments.length} deployments`);
    
    if (deployments.length === 0) {
      return res.status(200).json({
        success: true, 
        message: "No deployments found for this project" 
      });
    }
    
    // 2. Get logs for the most recent deployment
    const latestDeployment = deployments[0];
    console.log(`Getting logs for deployment ${latestDeployment.uid || latestDeployment.id}`);
    
    const logsResponse = await axios.get(`https://api.vercel.com/v1/deployments/${latestDeployment.uid || latestDeployment.id}/events`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      }
    });
    
    const logs = logsResponse.data.events || [];
    console.log(`Found ${logs.length} logs`);
    
    // 3. Filter logs for SQL queries
    const sqlLogs = logs.filter(log => {
      return log.text && log.text.includes('Direct query:');
    });
    console.log(`Found ${sqlLogs.length} SQL logs`);
    
    // 4. Store SQL logs in database
    let storedLogs = 0;
    if (sqlLogs.length > 0) {
      console.log("Connecting to database");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Required for Neon's SSL connections
        }
      });
      
      console.log("Creating table if needed");
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sql_logs (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP,
          query TEXT,
          log_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log("Inserting logs");
      for (const log of sqlLogs) {
        const queryMatch = log.text.match(/Direct query: (.*)/);
        const sqlQuery = queryMatch ? queryMatch[1] : '';
        
        await pool.query(
          'INSERT INTO sql_logs (timestamp, query, log_data) VALUES ($1, $2, $3)',
          [new Date(log.timestamp), sqlQuery, JSON.stringify(log)]
        );
        storedLogs++;
      }
      
      console.log("Closing database connection");
      await pool.end();
    }
    
    res.status(200).json({
      success: true,
      deploymentsFound: deployments.length,
      logsFound: logs.length,
      sqlLogsFound: sqlLogs.length,
      sqlLogsStored: storedLogs,
      sampleLogs: sqlLogs.slice(0, 3).map(log => ({
        timestamp: log.timestamp,
        text: log.text
      }))
    });
  } catch (error) {
    console.error("Function crashed:", error);
    
    if (error.response) {
      console.error("API Error Response:", {
        status: error.response.status,
        data: error.response.data
      });
      
      return res.status(500).json({
        error: error.message,
        apiErrorStatus: error.response.status,
        apiErrorData: error.response.data,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};