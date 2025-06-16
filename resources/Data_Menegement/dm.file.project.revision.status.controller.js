const axios = require("axios");
const {
  fetchHubs,
} = require("../../utils/data_management_utils/data.amanegement.hubs.js");
const { fetchProjects } = require("../libs/aec.get.project.js");

const {GetProjectFilesFolders } = require("../../utils/data_management_utils/data.management.project.files-folders.js");

const GetFileRevisionStatus = async (req, res) => {
  const token = req.cookies["access_token"];
  const hubQLId =
    "urn:adsk.ace:prod.scope:1f36a462-b349-4443-b667-23dd02460a04";
  const projectQLId =
    "urn:adsk.workspace:prod.project:d6d34176-84b3-49ee-9672-0b51c86d8ef5";
  const modelQLId =
    "YWVjZH5uTVBCMU1OSTRZSjNMQW9HQ21HcTJBX0wyQ35hVzVqc3lKSlRuZThKX3p0NzZtNmpn";


  if (!token) {
    return res.status(401).json({
      data: null,
      error: "No token provided",
      message: "Authorization token is required",
    });
  }

  try {
    const hubDMs = await fetchHubs(token);

    if (!Array.isArray(hubs)) {
      throw new Error("Unexpected hubs format");
    }

    console.log("✅ Hubs:", hubDMs);

    const hubDMFiltered = hubDMs.filter(
      (hub) => hub.Name === "TAD_HUB"
    );

    // Assuming you want the first hub
    const projectsQL = await fetchProjects(token, hubId);
    if (!Array.isArray(projects)) {
      throw new Error("Unexpected projects format");
    }

    const projectQLAlternativeId =
      projectsQL[0]?.alternativeIdentifiers?.dataManagementAPIProjectId;

    if (!projectAlternativeId) {
      return res.status(404).json({
        data: null,
        error: "Project not found",
        message: "No project found with the provided ID",
      });
    }

    const projectFilesFolders = await GetProjectFilesFolders(
      token,
      hubQLId,
      projectQLId
    );
    
    if (!Array.isArray(projectFilesFolders)) {
      throw new Error("Unexpected projectFilesFolders format");
    }
    console.log("Project Files and Folders:", projectFilesFolders);



    const projectReviews = await GetProjectReviews(token, projectQLAlternativeId);

    if (!Array.isArray(projectReviews)) {
      throw new Error("Unexpected projectReviews format");
    }

    res.status(200).json({
      data: {
        hubDMFiltered,
        projectQLAlternativeId,
        projectFilesFolders,
        projectReviews,
      },
      error: null,
      message: "Project reviews retrieved successfully",
    });

  } catch (error) {
    console.error("Error fetching project reviews:", error);
    return res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve project reviews",
    });
  }
};

module.exports = {
  GetFileRevisionStatus,
};
