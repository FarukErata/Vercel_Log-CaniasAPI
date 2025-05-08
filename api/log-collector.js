const axios = require('axios');

module.exports = async (req, res) => {
  try {
    console.log("Function started");
    const results = {};
    
    // 1. Test basic authentication with v9 API
    try {
      console.log("Testing authentication");
      const userResponse = await axios.get("https://api.vercel.com/v9/user", {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
        }
      });
      results.auth = "success";
      results.user = userResponse.data.user ? userResponse.data.user.username : "unknown";
    } catch (error) {
      results.auth = "failed";
      results.authError = error.message;
      if (error.response) {
        results.authErrorDetails = {
          status: error.response.status,
          data: error.response.data
        };
      }
    }
    
    // Only proceed if authentication worked
    if (results.auth === "success") {
      // 2. Try to get projects list using v9 API
      try {
        console.log("Getting projects list");
        const projectsResponse = await axios.get("https://api.vercel.com/v9/projects", {
          headers: {
            Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
          }
        });
        
        const projects = projectsResponse.data.projects || [];
        results.projectsCount = projects.length;
        results.projects = projects.map(p => ({
          id: p.id,
          name: p.name
        }));
        
        // 3. Find our target project
        if (process.env.PROJECT_ID) {
          console.log(`Looking for project with ID: ${process.env.PROJECT_ID}`);
          const targetProject = projects.find(p => p.id === process.env.PROJECT_ID);
          results.targetProjectFound = !!targetProject;
          results.targetProject = targetProject ? {
            id: targetProject.id,
            name: targetProject.name
          } : null;
        } else {
          results.targetProjectFound = false;
          results.error = "PROJECT_ID environment variable is not set";
        }
        
        // 4. If we found the project, try to get its deployments
        if (results.targetProjectFound) {
          console.log(`Getting deployments for project: ${results.targetProject.name}`);
          const deploymentsResponse = await axios.get(`https://api.vercel.com/v6/deployments`, {
            headers: {
              Authorization: `Bearer ${process.env.VERCEL_TOKEN}`
            },
            params: {
              projectId: process.env.PROJECT_ID,
              limit: 5
            }
          });
          
          const deployments = deploymentsResponse.data.deployments || [];
          results.deploymentsCount = deployments.length;
          results.deployments = deployments.map(d => ({
            id: d.id || d.uid,
            url: d.url,
            created: d.created
          }));
        }
      } catch (error) {
        results.projectsError = error.message;
        if (error.response) {
          results.projectsErrorDetails = {
            status: error.response.status,
            data: error.response.data
          };
        }
      }
    }
    
    // Return all the test results
    res.status(200).json({
      success: true,
      diagnostics: results
    });
  } catch (error) {
    console.error("Function crashed:", error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
};