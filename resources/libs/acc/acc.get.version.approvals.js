const axios = require("axios")

/**
 * Normalize an ACC project id to the bare GUID used by Construction APIs.
 * Supports:
 * - "urn:adsk.workspace:prod.project:{guid}"
 * - "b.{guid}"
 * - "{guid}"
 *
 * @param {string} projectId
 * @returns {string}
 */
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "")
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop()
  return s.replace(/^b\./i, "")
}

/**
 * Fetch the approval status history for a given version within a project.
 *
 * Note: A 404 is expected when a version has no review history; we return [] in that case.
 *
 * @param {string} token APS access token
 * @param {string} projectId Project URN/raw GUID/b.{guid}
 * @param {string} versionId Version URN
 * @returns {Promise<Array>}
 */
async function fetchVersionApprovalStatuses(token, projectId, versionId) {
  if (!token) throw new Error("Missing APS access token")
  if (!projectId) throw new Error("Missing projectId")
  if (!versionId) throw new Error("Missing versionId")

  const pid = normalizeAccProjectId(projectId)
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${pid}/versions/${encodeURIComponent(
    versionId
  )}/approval-statuses`

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return Array.isArray(data?.results) ? data.results : []
  } catch (err) {
    if (err?.response?.status === 404) return []
    console.error(
      "Error fetching approval statuses:",
      err?.response?.data || err?.message || err
    )
    throw err
  }
}

/**
 * Extract a concise summary from a version's approval status history.
 *
 * @param {Array} statuses
 * @returns {{status: string|null, reviewId: string|null, stepName: string|null, updatedAt: string|null}}
 */
function summarizeApprovalStatuses(statuses = []) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return { status: "NOT_IN_REVIEW", reviewId: null, stepName: null, updatedAt: null }
  }

  const sorted = [...statuses].sort((a, b) => {
    const aT = a?.attributes?.updatedAt || a?.attributes?.createdAt || ""
    const bT = b?.attributes?.updatedAt || b?.attributes?.createdAt || ""
    return String(bT).localeCompare(String(aT))
  })

  const s = sorted[0]
  return {
    status: s?.attributes?.status || null,
    reviewId: s?.relationships?.review?.data?.id || null,
    stepName: s?.attributes?.stepName || null,
    updatedAt: s?.attributes?.updatedAt || s?.attributes?.createdAt || null,
  }
}

module.exports = {
  fetchVersionApprovalStatuses,
  summarizeApprovalStatuses,
  normalizeAccProjectId,
}
