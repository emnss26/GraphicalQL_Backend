const { fetchModels } = require("../../libs/aec/aec.get.models.js");

const GetAECModels = async (req, res) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is required",
      data: null,
      error: "Unauthorized"
    });
  }

  try {
    const models = await fetchModels(token, projectId);

    return res.status(200).json({
      success: true,
      message: "Models retrieved successfully",
      data: { models },
      error: null
    });
  } catch (error) {
    console.error(`❌ Error fetching models for project ${projectId}:`, error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve models",
      data: null,
      error: error.message
    });
  }
};

module.exports = { GetAECModels };