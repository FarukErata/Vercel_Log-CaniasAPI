const axios = require('axios');
const { Pool } = require('pg');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // 1. Fetch deployments
    console.log("Fetching deployments");
    const deploymentsResponse = await axios.get("https://api.vercel.com/v1/deployments", {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        projectId: process.env.PROJECT_ID,
        limit: 10  // Get more deployments
      }
    });
    
    const deployments = deploymentsResponse.data.deployments || [];
    console.log(`Found ${deployments.length} deployments`);
    console.log(`Project ID being used: ${process.env.PROJECT_ID}`);
    
    // Log deployment details
    deployments.forEach((dep, index) => {
      console.log(`Deployment ${index + 1}: ${dep.uid || dep.id}, Created: ${new Date(dep.created).toISOString()}`);
    });
    
    if (deployments.length === 0) {
      return res.status(200).json({
        success: true, 
        message: "No deployments found for this project" 
      });
    }
    
    // 2. Check multiple deployments for logs
    let allLogs = [];
    let deploymentsSummary = [];
    
    // Check up to 5 most recent deployments
    for (let i = 0; i < Math.min(5, deployments.length); i++) {
      const deployment = deployments[i];
      console.log(`Checking logs for deployment ${i + 1}: ${deployment.uid || deployment.id}`);
      
      try {
        const logsResponse = await axios.get(`https://api.vercel.com/v1/deployments/${deployment.uid || deployment.id}/events`, {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
          }
        });
        
        const deploymentLogs = logsResponse.data.events || [];
        console.log(`Found ${deploymentLogs.length} logs for deployment ${i + 1}`);
        
        // Get a sample of log types to understand what we're dealing with
        if (deploymentLogs.length > 0) {
          const logSample = deploymentLogs.slice(0, 3);
          console.log("Log sample for deployment:", 
            logSample.map(log => ({
              type: log.type,
              text: log.text ? (log.text.substring(0, 50) + (log.text.length > 50 ? '...' : '')) : 'No text'
            }))
          );
        }
        
        allLogs = [...allLogs, ...deploymentLogs];
        deploymentsSummary.push({
          id: deployment.uid || deployment.id,
          logs: deploymentLogs.length
        });
      } catch (error) {
        console.error(`Error fetching logs for deployment ${deployment.uid || deployment.id}:`, error.message);
      }
    }
    
    console.log(`Total logs found across all deployments: ${allLogs.length}`);
    
    // 3. Try to find SQL logs more generically - check multiple patterns
    const sqlQueries = [];
    
    allLogs.forEach(log => {
      if (!log.text) return;
      
      // Check for various SQL log patterns
      const patterns = [
        /Direct query:\s*(.*)/i,
        /SQL query:\s*(.*)/i,
        /SELECT\s+.*\s+FROM\s+/i,
        /INSERT\s+INTO\s+/i,
        /UPDATE\s+.*\s+SET\s+/i,
        /DELETE\s+FROM\s+/i
      ];
      
      for (const pattern of patterns) {
        const match = log.text.match(pattern);
        if (match) {
          const query = match[1] || log.text;
          sqlQueries.push({
            timestamp: log.timestamp,
            query: query,
            fullText: log.text,
            deployment: log.deploymentId
          });
          break; // Stop after finding the first match
        }
      }
    });
    
    console.log(`Found ${sqlQueries.length} SQL queries across all deployments`);
    
    // 4. Store SQL logs in database
    let storedLogs = 0;
    if (sqlQueries.length > 0) {
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
      for (const log of sqlQueries) {
        await pool.query(
          'INSERT INTO sql_logs (timestamp, query, log_data) VALUES ($1, $2, $3)',
          [new Date(log.timestamp || Date.now()), log.query, JSON.stringify(log)]
        );
        storedLogs++;
      }
      
      console.log("Closing database connection");
      await pool.end();
    }
    
    res.status(200).json({
      success: true,
      deploymentsFound: deployments.length,
      totalLogsFound: allLogs.length,
      deploymentsSummary: deploymentsSummary,
      sqlLogsFound: sqlQueries.length,
      sqlLogsStored: storedLogs,
      sampleLogs: sqlQueries.slice(0, 3).map(log => ({
        timestamp: log.timestamp,
        query: log.query.substring(0, 100) + (log.query.length > 100 ? '...' : '')
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