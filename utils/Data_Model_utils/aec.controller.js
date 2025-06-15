const axios = require("axios");

const { fetchHubs }     = require("../../resources/libs/aec.get.hubs.js");
const { fetchProjects } = require("../../resources/libs/aec.get.project.js");
const { fetchModels }   = require("../../resources/libs/aec.get.models.js");
const { fetchSheets }   = require("../../resources/libs/aec.get.model.sheets.js");


const GetModelSheets = async (req, res) => {
  try {
    const token = req.cookies["access_token"];
    const hubId = "urn:adsk.ace:prod.scope:1f36a462-b349-4443-b667-23dd02460a04"; 
    const projectId = "urn:adsk.workspace:prod.project:d6d34176-84b3-49ee-9672-0b51c86d8ef5";
    const modelId = "YWVjZH5uTVBCMU1OSTRZSjNMQW9HQ21HcTJBX0wyQ35hVzVqc3lKSlRuZThKX3p0NzZtNmpn";

    if (!token) {
      return res.status(401).json({
        data: null,
        error: "No token provided",
        message: "Authorization token is required",
      });
    }

   const hubs = await fetchHubs(token);
    //console.log("✅ Hubs:", hubs);

     const projects = await fetchProjects(token, hubId);
     //console.log(`📁 Projects for hub ${hubId}:`, projects);

    const models = await fetchModels(token, projectId);
    //console.log(`🗂 Models for project ${projectId}:`, models);

    const sheets = await fetchSheets(token, modelId, "property.name.category==Sheets");
    //console.log(`📄 Sheets for model ${modelId}:`, sheets);

     return res.status(200).json({
      data: { 
        hubs: hubs,
        projects: projects,
        models: models,
        sheets: sheets
      },
      error: null,
      message: "Hubs, projects and models retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching hubs:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve hubs",
    });
  }
};

module.exports = {
  GetModelSheets,
};
