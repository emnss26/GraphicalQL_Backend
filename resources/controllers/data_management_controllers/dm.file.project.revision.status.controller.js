const axios = require("axios");
const {
  fetchHubs,
} = require("../../libs/data_management/data.management.get.hubs.js");
const { fetchProjects } = require("../../libs/aec/aec.get.project.js");

const {GetProjectFilesFolders } = require("../../../utils/data_management_utils/data.management.project.files-folders.js");

const hubId = process.env.APS_HUB_ID;

const GetFileRevisionStatus = async (req, res) => {
  const token = req.cookies["access_token"];
  const altProjectId = req.headers['x-alt-project-id'];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authorization token is required",
      data: null,
      error: "No token provided",
    });
  }

  try {
    

    const projectFilesFolders = await GetProjectFilesFolders(
      token,
      hubId,
      altProjectId
    );
    
    if (!Array.isArray(projectFilesFolders)) {
      throw new Error("Unexpected projectFilesFolders format");
    }
    //console.log("Project Files and Folders:", projectFilesFolders);

    const projectReviews = await GetProjectReviews(token, projectQLAlternativeId);

    if (!Array.isArray(projectReviews)) {
      throw new Error("Unexpected projectReviews format");
    }

    res.status(200).json({
      success: true,
      message: "Project reviews retrieved successfully",
      data: {
        projectFilesFolders,
        projectReviews,
      },
      error: null,
    });

  } catch (error) {
    console.error("Error fetching project reviews:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve project reviews",
      data: null,
      error: error.message,
    });
  }
};

module.exports = {
  GetFileRevisionStatus,
};
