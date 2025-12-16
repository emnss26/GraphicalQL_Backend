const { fetchaccprojects } = require("../../libs/acc/acc.get.projects.js");
const { fetchDataManagementHubId } = require("../../libs/data_management/data.management.get.hub.id.js");

const GetProjects = async (req, res, next) => {
  try {
    const token = req.cookies["access_token"];
    if (!token) {
      const error = new Error("Access token is required");
      error.status = 401;
      error.code = "Unauthorized";
      return next(error);
    }

    const rawHubId = process.env.RAWHUBID;

    // Get Hub ID from Data Management
    await fetchDataManagementHubId(token, rawHubId);

    // Get ACC projects from Autodesk Construction Cloud
    const accProjects = await fetchaccprojects(token, rawHubId);

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: { accProjects },
      error: null,
    });
  } catch (error) {
    error.code = error.code || "ACCProjectsFetchFailed";
    return next(error);
  }
};

module.exports = { GetProjects };
