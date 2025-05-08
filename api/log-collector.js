const axios = require('axios');
const { Pool } = require('pg');

module.exports = async (req, res) => {
  try {
    // Test database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    // Simple query to test connection
    const result = await pool.query('SELECT NOW()');
    await pool.end();
    
    res.status(200).json({
      message: "Database connection successful",
      timestamp: new Date().toISOString(),
      db_time: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};