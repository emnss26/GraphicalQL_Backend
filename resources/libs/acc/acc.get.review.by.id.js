const axios = require("axios");

// Normaliza a GUID pelón para Reviews (sin "b." ni URN)
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop();
  return s.replace(/^b\./i, "");
}

async function fetchReviewById(token, projectId, reviewId) {
  const accProjectId = normalizeAccProjectId(projectId);
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${accProjectId}/reviews/${reviewId}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Revision", data)
  return data || null;
}

module.exports = { fetchReviewById };