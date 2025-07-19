const knex = require('knex')(require('../../../knexfile').development);
const axios = require("axios");

const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js");
const { fetchTopFoldersGraphql } = require("../../libs/aec/aec.get.topfolder.js");
const { fetchSubFolders } = require("../../libs/aec/aec.get.subfolder.js");

const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const {GetProjectReviews} = require("../../../utils/data_management_utils/data.management.project.reviews.utils.js");


const GetModelSheets = async (req, res) => {

  try {
    let projectId = req.params.projectId;
    const token = req.cookies["access_token"];
    const altProjectId = req.headers['x-alt-project-id'];
     const selectedFolderId = req.headers['selected-folder-id'];

    if (!altProjectId) {
  return res.status(400).json({
    data: null,
    error: "altProjectId header missing",
    message: "Alternative Project ID is required"
  });
}

    if (!token) {
      return res.status(401).json({ data: null, error: "No token provided", message: "Authorization token is required" });
    }

    const selectedRows = await knex('model_selection').where({ project_id: projectId }).select('model_id');
    const selectedModelIds = selectedRows.map(r => r.model_id);

    if (!selectedModelIds.length) {
      return res.status(404).json({ error: "No models selected for this project" });
    }

     let sheets = [];
    for (const modelId of selectedModelIds) {
      const modelSheets = await fetchSheets(token, modelId, "property.name.category==Sheets");
      sheets = sheets.concat(modelSheets);
    }
    //console.log(`📄 Sheets for model ${modelId}:`, sheets);

    const files = await fetchFolderContents(token, altProjectId, selectedFolderId);
    console.log("📂 Files in folder", files);

    const projectReviews = await GetProjectReviews(token, altProjectId);
    //console.log("Project reviews:", projectReviews);
    const reviewMap = new Map(projectReviews.map(r => [r.id, r]));

    const revisionStatuses = await Promise.all(
      files.map(async (file) => {
        // 1) Obtén el URN de versión real:
        const versionsData = file.relationships.versions?.data;
        if (!versionsData?.length) {
          return { fileId: file.id, error: "No hay versiones incluidas" };
        }
        const versionedFileUrn = versionsData[0].id;

        // 2) Llama al endpoint con ese URN:
        const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/`
                  + `${altProjectId}/versions/${encodeURIComponent(versionedFileUrn)}/approval-status`;
        try {
          const { data: resp } = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const result = resp.results?.[0] || {};
          const reviewId = result.review?.id || null;

          const pr = reviewMap.get(reviewId) || {};

          return {
            fileId: file.id,
            versionedFileUrn,
            status: result.approvalStatus?.value    || "UNKNOWN",
            label:  result.approvalStatus?.label    || null,
            reviewId,
            reviewStatus:    result.review?.status    || null,
            reviewSequenceId:result.review?.sequenceId|| null,
            reviewName:      pr.name                  || null,
            createdAt:       pr.createdAt             || null,
            createdByName:   pr.createdBy?.name || pr.createdBy?.autodeskId || null,
            currentStepDueDate: pr.currentStepDueDate || null,
            updatedAt:       pr.updatedAt             || null,
            finishedAt:      pr.finishedAt            || null,
            sequenceId:      pr.sequenceId            || null,
            workflowId:      pr.workflowId            || null,
          };
        } catch (err) {
          return {
            fileId: file.id,
            versionedFileUrn,
            error: err.response?.data || err.message
          };
        }
      })
    );
    
    return res.status(200).json({
      data: {
        sheets: sheets,
        files: files,
        projectReviews: projectReviews,
        revisionStatuses: revisionStatuses
      },
      error: null,
      message: "Plans retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve plans",
    });
  }
};

module.exports = {
  GetModelSheets,
};
