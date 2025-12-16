const axios = require("axios");
const {
  fetchHubs,
} = require("../../libs/data_management/data.management.get.hubs.js");
const { fetchProjects } = require("../../libs/aec/aec.get.project.js");

const {GetProjectFilesFolders } = require("../../../utils/data_management_utils/data.management.project.files-folders.js");

const hubId = process.env.APS_HUB_ID;

const GetFileRevisionStatus = async (req, res, next) => {
  const token = req.cookies["access_token"];
  const altProjectId = req.headers['x-alt-project-id'];

  if (!token) {
    const error = new Error("Authorization token is required");
    error.status = 401;
    error.code = "Unauthorized";
    return next(error);
  }

  try {
    const projectFilesFolders = await GetProjectFilesFolders(
      token,
      hubId,
      altProjectId
    );

    if (!Array.isArray(projectFilesFolders)) {
      const error = new Error("Unexpected projectFilesFolders format");
      error.code = "InvalidProjectFilesFolders";
      return next(error);
    }

    const projectReviews = await GetProjectReviews(token, projectQLAlternativeId);

    if (!Array.isArray(projectReviews)) {
      const error = new Error("Unexpected projectReviews format");
      error.code = "InvalidProjectReviews";
      return next(error);
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
    error.code = error.code || "ProjectReviewFetchFailed";
    return next(error);
  }
};

module.exports = {
  GetFileRevisionStatus,
};
