const axios = require('axios');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    const results = {};
    
    // 1. Test basic authentication with v4/v6 API (known stable versions)
    try {
      console.log("Testing authentication with v1 API");
      const userResponse = await axios.get("https://api.vercel.com/v1/user", {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
        }
      });
      results.auth = "success";
      results.user = userResponse.data.username || "unknown";
    } catch (error) {
      results.authV4 = "failed";
      results.authV4Error = error.message;
      
      
    }
    
    // 2. Check if the token itself looks valid (regardless of API version issues)
    if (process.env.VERCEL_TOKEN) {
      results.tokenProvided = true;
      results.tokenLength = process.env.VERCEL_TOKEN.length;
      results.tokenPrefix = process.env.VERCEL_TOKEN.substring(0, 4) + '...';
    } else {
      results.tokenProvided = false;
    }
    
    // 3. Check PROJECT_ID
    if (process.env.PROJECT_ID) {
      results.projectIdProvided = true;
      results.projectId = process.env.PROJECT_ID;
    } else {
      results.projectIdProvided = false;
    }
    
    // Return all the diagnostics
    res.status(200).json({
      success: true,
      diagnostics: results,
      message: "There appears to be an issue with your Vercel API token. Please verify it's valid and has the correct permissions."
    });
  } catch (error) {
    console.error("Function crashed:", error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};