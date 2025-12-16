const axios = require("axios");

const { fetchaccprojects } = require("../../libs/acc/acc.get.projects.js");
const { fetchDataManagementHubId } = require("../../libs/data_management/data.management.get.hub.id.js");

const GetProjects = async (req, res) => {
  try {
    const token = req.cookies["access_token"];
    if (!token) {
      return res.status(401).json({
        data: null,
        error: "Unauthorized",
        message: "Access token is required",
      });
    }

    const rawHubId = process.env.RAWHUBID;

    // Get Hub ID from Data Management
    const dataManagementHubId = await fetchDataManagementHubId(token, rawHubId);

    // Get ACC projects from Autodesk Construction Cloud
    const accProjects = await fetchaccprojects(token, rawHubId);

    return res.status(200).json({
      data: { accProjects },
      error: null,
      message: "Projects fetched successfully",
    });
  } catch (error) {
    console.error("❌ Error fetching ACC projects:", error);
    return res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve ACC projects",
    });
  }
};

module.exports = { GetProjects };