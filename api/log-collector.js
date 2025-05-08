const axios = require('axios');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    
    // 1. First, get a list of deployments
    console.log("Getting list of deployments");
    const deploymentsResponse = await axios.get(`https://api.vercel.com/v13/deployments`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      },
      params: {
        limit: 5 // Just get a few recent deployments
      }
    });
    
    const deployments = deploymentsResponse.data.deployments || [];
    console.log(`Found ${deployments.length} deployments`);
    
    if (deployments.length === 0) {
      return res.status(200).json({
        message: "No deployments found",
        success: true
      });
    }
    
    // 2. Try to get logs for the most recent deployment
    const latestDeployment = deployments[0];
    console.log(`Getting logs for deployment ${latestDeployment.uid}`);
    
    const logsResponse = await axios.get(`https://api.vercel.com/v2/deployments/${latestDeployment.uid}/events`, {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
      }
    });
    
    const logs = logsResponse.data.events || [];
    
    res.status(200).json({
      success: true,
      deploymentId: latestDeployment.uid,
      totalLogs: logs.length,
      sampleLogs: logs.slice(0, 3) // Just return first 3 logs as sample
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