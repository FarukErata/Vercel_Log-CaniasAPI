const { Vercel } = require('@vercel/sdk');
const { Pool } = require('pg');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // Initialize Vercel SDK
    const vercel = new Vercel({
      bearerToken: process.env.VERCEL_TOKEN,
    });
    
    // Get recent deployments for your main project
    const deploymentsResponse = await vercel.deployments.getDeployments({
      limit: 5,
      projectId: process.env.PROJECT_ID, // The project ID of your main application
    });
    
    console.log(`Found ${deploymentsResponse.deployments.length} deployments`);
    
    // Track all SQL logs
    let allSqlLogs = [];
    
    // Process each deployment
    for (const deployment of deploymentsResponse.deployments) {
      console.log(`Analyzing deployment: ${deployment.uid}`);
      
      // Get logs for this deployment
      const logsResponse = await vercel.deployments.getDeploymentEvents({
        idOrUrl: deployment.uid,
      });
      
      // Check if we got logs back
      if (Array.isArray(logsResponse)) {
        const logs = logsResponse;
        console.log(`Found ${logs.length} logs for deployment ${deployment.uid}`);
        
        // Filter for SQL queries
        const sqlLogs = logs.filter(log => 
          log.text && (
            log.text.includes('Direct query:') || 
            log.text.includes('SQL query:') ||
            /SELECT\s+.*\s+FROM\s+/i.test(log.text) ||
            /INSERT\s+INTO\s+/i.test(log.text) ||
            /UPDATE\s+.*\s+SET\s+/i.test(log.text) ||
            /DELETE\s+FROM\s+/i.test(log.text)
          )
        );
        
        console.log(`Found ${sqlLogs.length} SQL logs in this deployment`);
        allSqlLogs = [...allSqlLogs, ...sqlLogs];
      } else {
        console.log(`No logs found for deployment ${deployment.uid}`);
      }
    }
    
    console.log(`Total SQL logs found: ${allSqlLogs.length}`);
    
    // Store logs in database if we found any
    let storedLogs = 0;
    if (allSqlLogs.length > 0) {
      console.log("Connecting to database");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
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
      for (const log of allSqlLogs) {
        // Extract the SQL query from the log text
        let sqlQuery = log.text;
        const directQueryMatch = log.text.match(/Direct query:\s*(.*)/i);
        const sqlQueryMatch = log.text.match(/SQL query:\s*(.*)/i);
        
        if (directQueryMatch) {
          sqlQuery = directQueryMatch[1];
        } else if (sqlQueryMatch) {
          sqlQuery = sqlQueryMatch[1];
        }
        
        await pool.query(
          'INSERT INTO sql_logs (timestamp, query, log_data) VALUES ($1, $2, $3)',
          [new Date(log.created), sqlQuery, JSON.stringify(log)]
        );
        storedLogs++;
      }
      
      console.log("Closing database connection");
      await pool.end();
    }
    
    res.status(200).json({
      success: true,
      deploymentsFound: deploymentsResponse.deployments.length,
      sqlLogsFound: allSqlLogs.length,
      sqlLogsStored: storedLogs,
      sampleLogs: allSqlLogs.slice(0, 3).map(log => ({
        timestamp: new Date(log.created).toISOString(),
        text: log.text
      }))
    });
  } catch (error) {
    console.error("Function crashed:", error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};