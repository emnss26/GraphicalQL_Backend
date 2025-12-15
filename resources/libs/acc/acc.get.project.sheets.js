const axios = require("axios");

/**
 * Normalizes an ACC project ID to the bare UUID string.
 * Supports formats like "urn:adsk.workspace:prod.project:{id}" or "b.{id}".
 * 
 * @param {string} projectId - Original project ID in different formats
 * @returns {string} - Normalized project ID
 */
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop();
  return s.replace(/^b\./i, "");
}

/**
 * Fetches all sheets (drawings) from ACC Construction Sheets Index for a project.
 * Uses pagination to retrieve full list if over the limit.
 * 
 * @param {string} token - APS access token
 * @param {string} projectId - ACC project ID
 * @param {number} limit - Number of results per page (default: 200)
 * @returns {Promise<Array>} - List of sheets (drawings)
 */
async function fetchProjectSheets(token, projectId, limit = 200) {
  const pid = normalizeAccProjectId(projectId);
  let url = `https://developer.api.autodesk.com/construction/sheets/v1/projects/${pid}/sheets?limit=${limit}`;
  const results = [];

  while (url) {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (Array.isArray(data?.results)) results.push(...data.results);

    const next = data?.pagination?.nextUrl;
    if (!next) break;

    url = next.startsWith("http")
      ? next
      : `https://developer.api.autodesk.com${next}`;
  }

  return results;
}

module.exports = {
  fetchProjectSheets,
  normalizeAccProjectId,
};