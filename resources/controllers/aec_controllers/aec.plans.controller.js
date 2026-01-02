const knex = require("knex")(require("../../../knexfile").development)
const axios = require("axios")

const { fetchSheets } = require("../../libs/aec/aec.get.model.sheets.js")
const { fetchFolderContents } = require("../../libs/data_management/data.management.get.folder.content.js")
const {
  GetProjectReviews,
} = require("../../../utils/data_management_utils/data.management.project.reviews.utils.js")

/**
 * Returns:
 * - Sheets from selected AEC models
 * - Files from selected folder
 * - Project reviews
 * - Approval status per file version (first included version)
 */
const GetModelSheets = async (req, res, next) => {
  const { projectId } = req.params
  const token = req.cookies?.access_token
  const altProjectId = req.headers["x-alt-project-id"]
  const selectedFolderId = req.headers["selected-folder-id"]

  if (!token) {
    const err = new Error("Authorization token is required")
    err.status = 401
    err.code = "Unauthorized"
    return next(err)
  }

  if (!altProjectId) {
    const err = new Error("Alternative Project ID is required")
    err.status = 400
    err.code = "MissingAltProjectId"
    return next(err)
  }

  try {
    // 1) Get selected model IDs from DB
    const selectedRows = await knex("model_selection")
      .where({ project_id: projectId })
      .select("model_id")

    const selectedModelIds = selectedRows.map((row) => row.model_id)

    if (!selectedModelIds.length) {
      const err = new Error("No models selected for this project")
      err.status = 404
      err.code = "NoModelsSelected"
      return next(err)
    }

    // 2) Fetch sheets from selected models (AEC)
    const sheets = (
      await Promise.all(
        selectedModelIds.map((id) =>
          fetchSheets(token, id, "property.name.category==Sheets")
        )
      )
    ).flat()

    // 3) Fetch files from selected folder (Data Management)
    const files = await fetchFolderContents(token, altProjectId, selectedFolderId)

    // 4) Fetch project reviews and index them for fast lookup
    const projectReviews = await GetProjectReviews(token, altProjectId)
    const reviewMap = new Map(projectReviews.map((r) => [r.id, r]))

    const getApprovalStatusForFile = async (file) => {
      const version = file?.relationships?.versions?.data?.[0]
      if (!version?.id) {
        return { fileId: file.id, error: "No versions included" }
      }

      const versionedFileUrn = version.id
      const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${altProjectId}/versions/${encodeURIComponent(
        versionedFileUrn
      )}/approval-status`

      try {
        const { data } = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const result = data.results?.[0] || {}
        const reviewId = result.review?.id
        const pr = reviewMap.get(reviewId) || {}

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
        }
      } catch (err) {
        return {
          fileId: file.id,
          versionedFileUrn,
          error: err.response?.data || err.message,
        }
      }
    }

    // 5) Resolve approval status per file (parallel)
    const revisionStatuses = await Promise.all((files || []).map(getApprovalStatusForFile))

    return res.status(200).json({
      success: true,
      message: "Plans retrieved successfully",
      data: {
        sheets,
        files,
        projectReviews,
        revisionStatuses,
      },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "AECPlansFetchFailed"
    return next(err)
  }
}

module.exports = { GetModelSheets }
