const axios = require("axios");

const { fetchHubs } = require("../../libs/aec/aec.get.hubs.js");
const { fetchProjects } = require("../../libs/aec/aec.get.project.js");
const { fetchaccprojects } = require("../../libs/acc/acc.get.projects.js");
const { fetchDataManagementHubs } = require("../../libs/data_management/data.management.get.hubs.js");
const { fetchDataManagementHubId } = require("../../libs/data_management/data.managment.get.hub.id.js");

const GetProjects = async (req,res) =>{

  
    try{
        const token = req.cookies["access_token"];

    if (!token) {
      return res.status(401).json({ data: null, error: "No token provided", message: "Authorization token is required" });
    }

    const rawHubId = process.env.RAWHUBID;

    const dataManagementHubId = await fetchDataManagementHubId(token, rawHubId);
    console.log("✅ Data Management Hub ID:", dataManagementHubId.relationships.projects);

    // Fetch ACC projects using the derived accountId
    const accProjects = await fetchaccprojects(token, rawHubId);
    console.log(`📁 ACC Projects for account ${accountId}:`, accProjects);

    res.status(200).json({
      data: {
        accProjects,
      },
      error: null,
      message: "Projects fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve projects",
    });
  }
};

module.exports = { GetProjects };
