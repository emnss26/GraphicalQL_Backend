const axios = require("axios");

/**
 * Normalize any project ID format to raw GUID.
 * - "b.xxx-yyy-zzz" → "xxx-yyy-zzz"
 * - "urn:adsk.workspace:prod.project:xxx-yyy-zzz" → "xxx-yyy-zzz"
 * - "xxx-yyy-zzz" → "xxx-yyy-zzz" (already normalized)
 */
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) {
    return s.split(":").pop();
  }
  return s.replace(/^b\./i, "");
}

/**
 * Fetch version approval history for a given version ID in a project.
 * @param {string} token - APS access token
 * @param {string} projectId - Project URN or raw GUID
 * @param {string} versionId - Version URN
 * @returns {Promise<Array>} - List of approval status objects
 */
async function fetchVersionApprovalStatuses(token, projectId, versionId) {
  const accProjectId = normalizeAccProjectId(projectId);
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${accProjectId}/versions/${encodeURIComponent(versionId)}/approval-statuses`;

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    // 404 is a valid response: means version has no review history
    if (err?.response?.status === 404) return [];
    console.error("Error fetching approval statuses:", err.response?.data || err.message);
    throw err;
  }
}

/**
 * Extracts the most recent approval status from a version's status history.
 * @param {Array} statuses - Approval status objects
 * @returns {Object} - Summary with status, reviewId, stepName, and updatedAt
 */
function summarizeApprovalStatuses(statuses = []) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return {
      status: "NOT_IN_REVIEW",
      reviewId: null,
      stepName: null,
      updatedAt: null,
    };
  }

  const sorted = [...statuses].sort((a, b) => {
    const aT = a.attributes?.updatedAt || a.attributes?.createdAt || "";
    const bT = b.attributes?.updatedAt || b.attributes?.createdAt || "";
    return String(bT).localeCompare(String(aT));
  });

  const s = sorted[0];
  return {
    status: s.attributes?.status || null,
    reviewId: s.relationships?.review?.data?.id || null,
    stepName: s.attributes?.stepName || null,
    updatedAt: s.attributes?.updatedAt || s.attributes?.createdAt || null,
  };
}

module.exports = {
  fetchVersionApprovalStatuses,
  summarizeApprovalStatuses,
};