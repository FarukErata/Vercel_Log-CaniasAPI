module.exports = async (req, res) => {
  try {
    // Just return a simple response
    res.status(200).json({
      message: "Log collector is working",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};