const axios = require("axios");

/**
 * Normalizes the project ID by removing URN or "b." prefix.
 * Used specifically for Construction Reviews API.
 * 
 * @param {string} projectId - Raw project URN or GUID
 * @returns {string} - Normalized project GUID
 */
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop();
  return s.replace(/^b\./i, "");
}

/**
 * Fetches a single review by its ID from Autodesk Construction Cloud.
 * 
 * @param {string} token - APS access token
 * @param {string} projectId - Project URN or GUID
 * @param {string} reviewId - Review ID
 * @returns {Promise<Object|null>} - Review data or null if not found
 */
async function fetchReviewById(token, projectId, reviewId) {
  const accProjectId = normalizeAccProjectId(projectId);
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${accProjectId}/reviews/${reviewId}`;

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data || null;
  } catch (error) {
    console.error("Error fetching review by ID:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchReviewById };