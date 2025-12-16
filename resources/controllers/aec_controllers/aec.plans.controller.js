const knex = require('knex')(require('../../../knexfile').development);
const axios = require("axios");

const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js");
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js");
const { GetProjectReviews } = require("../../../utils/data_management_utils/data.management.project.reviews.utils.js");

const GetModelSheets = async (req, res, next) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;
  const altProjectId = req.headers['x-alt-project-id'];
  const selectedFolderId = req.headers['selected-folder-id'];

  if (!token) {
    const error = new Error("Authorization token is required");
    error.status = 401;
    error.code = "Unauthorized";
    return next(error);
  }

  if (!altProjectId) {
    const error = new Error("Alternative Project ID is required");
    error.status = 400;
    error.code = "MissingAltProjectId";
    return next(error);
  }

  try {
    // Get selected model IDs from DB
    const selectedRows = await knex('model_selection')
      .where({ project_id: projectId })
      .select('model_id');

    const selectedModelIds = selectedRows.map(row => row.model_id);

    if (!selectedModelIds.length) {
      const error = new Error("No models selected for this project");
      error.status = 404;
      error.code = "NoModelsSelected";
      return next(error);
    }

    // Fetch sheets from selected models
    const sheets = (
      await Promise.all(
        selectedModelIds.map(id =>
          fetchSheets(token, id, "property.name.category==Sheets")
        )
      )
    ).flat();

    // Fetch files from selected folder
    const files = await fetchFolderContents(token, altProjectId, selectedFolderId);

    // Fetch project reviews
    const projectReviews = await GetProjectReviews(token, altProjectId);
    const reviewMap = new Map(projectReviews.map(r => [r.id, r]));

    // Extract version statuses
    const revisionStatuses = await Promise.all(
      files.map(async (file) => {
        const version = file.relationships?.versions?.data?.[0];
        if (!version?.id) {
          return { fileId: file.id, error: "No versions included" };
        }

        const versionedFileUrn = version.id;
        const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${altProjectId}/versions/${encodeURIComponent(versionedFileUrn)}/approval-status`;

        try {
          const { data } = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const result = data.results?.[0] || {};
          const reviewId = result.review?.id;
          const pr = reviewMap.get(reviewId) || {};

          return {
            fileId: file.id,
            versionedFileUrn,
            status: result.approvalStatus?.value || "UNKNOWN",
            label: result.approvalStatus?.label || null,
            reviewId,
            reviewStatus: result.review?.status || null,
            reviewSequenceId: result.review?.sequenceId || null,
            reviewName: pr.name || null,
            createdAt: pr.createdAt || null,
            createdByName: pr.createdBy?.name || pr.createdBy?.autodeskId || null,
            currentStepDueDate: pr.currentStepDueDate || null,
            updatedAt: pr.updatedAt || null,
            finishedAt: pr.finishedAt || null,
            sequenceId: pr.sequenceId || null,
            workflowId: pr.workflowId || null,
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
      success: true,
      message: "Plans retrieved successfully",
      data: {
        sheets,
        files,
        projectReviews,
        revisionStatuses
      },
      error: null
    });
  } catch (error) {
    error.code = error.code || "AECPlansFetchFailed";
    return next(error);
  }
};

module.exports = { GetModelSheets };
