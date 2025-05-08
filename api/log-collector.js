const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Just test if we can use axios 
    res.status(200).json({
      message: "Log collector with axios is working",
      timestamp: new Date().toISOString(),
      axios_version: axios.VERSION || "axios loaded"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};