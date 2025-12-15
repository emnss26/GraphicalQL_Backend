const { fetchModels } = require("../../libs/aec/aec.get.models.js");

const GetAECModels = async (req, res) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({
      data: null,
      error: "Unauthorized",
      message: "Authorization token is required"
    });
  }

  try {
    const models = await fetchModels(token, projectId);

    return res.status(200).json({
      data: { models },
      error: null,
      message: "Models retrieved successfully"
    });
  } catch (error) {
    console.error(`❌ Error fetching models for project ${projectId}:`, error.message);

    return res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve models"
    });
  }
};

module.exports = { GetAECModels };