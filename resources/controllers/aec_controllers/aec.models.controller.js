const axios = require("axios");

const { fetchModels } = require("../../libs/aec/aec.get.models.js");

const GetAECModels = async (req, res) => {

  let projectId = req.params.projectId;

  try {
    const token = req.cookies["access_token"];

    if (!token) {
      return res.status(401).json({ data: null, error: "No token provided", message: "Authorization token is required" });
    }

    const models = await fetchModels(token, projectId);
    //console.log(`🗂 Models for project ${projectId}:`, models);

    return res.status(200).json({
      data: {
        models: models
      },
      error: null,
      message: "Models retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching models:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve models",
    });
  }
};

module.exports = {
  GetAECModels,
};

          