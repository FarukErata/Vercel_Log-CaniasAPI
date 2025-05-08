const axios = require('axios');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // Print environment variables (sanitized)
    console.log("PROJECT_ID:", process.env.PROJECT_ID ? "Set" : "Not set");
    console.log("VERCEL_TOKEN:", process.env.VERCEL_TOKEN ? "Set (length: " + process.env.VERCEL_TOKEN.length + ")" : "Not set");
    
    // Test a simpler Vercel API endpoint first
    console.log("Testing Vercel API with user endpoint");
    const userResponse = await axios.get("https://api.vercel.com/v2/user", {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      }
    });
    
    // If we get here, the token is valid
    console.log("Vercel API auth successful");
    
    res.status(200).json({
      message: "Vercel API auth test successful",
      user: {
        username: userResponse.data.user.username,
        email: userResponse.data.user.email
      }
    });
  } catch (error) {
    console.error("Function crashed:", error);
    
    // More detailed error for API errors
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