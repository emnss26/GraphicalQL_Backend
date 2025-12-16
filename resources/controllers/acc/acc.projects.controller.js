const { fetchaccprojects } = require("../../libs/acc/acc.get.projects.js");
const { fetchDataManagementHubId } = require("../../libs/data_management/data.management.get.hub.id.js");

const GetProjects = async (req, res) => {
  try {
    const token = req.cookies["access_token"];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
        data: null,
        error: "Unauthorized",
      });
    }

    const rawHubId = process.env.RAWHUBID;

    // Get Hub ID from Data Management
    const dataManagementHubId = await fetchDataManagementHubId(token, rawHubId);

    // Get ACC projects from Autodesk Construction Cloud
    const accProjects = await fetchaccprojects(token, rawHubId);

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: { accProjects },
      error: null,
    });
  } catch (error) {
    console.error("❌ Error fetching ACC projects:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ACC projects",
      data: null,
      error: error.message,
    });
  }
};

module.exports = { GetProjects };