// libs/acc/acc.get.version.approvals.js
const axios = require("axios");

// Normaliza cualquier formato a GUID "pelón":
// - "b.xxx-yyy-zzz"   -> "xxx-yyy-zzz"
// - "urn:adsk.workspace:prod.project:xxx-yyy-zzz" -> "xxx-yyy-zzz"
// - "xxx-yyy-zzz"     -> "xxx-yyy-zzz" (ya está OK)
function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) {
    return s.split(":").pop();
  }
  return s.replace(/^b\./i, "");
}

async function fetchVersionApprovalStatuses(token, projectId, versionId) {
  const accProjectId = normalizeAccProjectId(projectId);
  console.log ("ProjectId", projectId)
  console.log ("version Id", versionId)
  console.log ("Version Id encoded", encodeURIComponent(versionId))
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${accProjectId}/versions/${encodeURIComponent(versionId)}/approval-statuses`;

  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log ("Revisions data ", data)
    console.log ("Revisions data results", data.results)
    console.log ("Revisions data pagination", data.pagination.totalResults)
    console.log ("Revisions data pagination-totalresults", data.pagination.totalResults)
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    // 404 => esa versión no tiene historial de aprobación (es normal)
    if (err?.response?.status === 404) return [];
    throw err;
  }
}

// “Pick” del último estado útil
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

module.exports = { fetchVersionApprovalStatuses, summarizeApprovalStatuses };