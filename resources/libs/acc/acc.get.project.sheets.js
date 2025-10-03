const axios = require("axios");

function normalizeAccProjectId(projectId) {
  const s = String(projectId || "");
  if (s.startsWith("urn:adsk.workspace:prod.project:")) return s.split(":").pop();
  return s.replace(/^b\./i, "");
}

/**
 * Trae hojas (Sheets) desde Construction Index.
 * Endpoint correcto: /construction/index/v1/projects/{projectId}/sheets
 */
async function fetchProjectSheets(token, projectId, limit = 200) {
  const pid = normalizeAccProjectId(projectId);
  let url = `https://developer.api.autodesk.com/construction/sheets/v1/projects/${pid}/sheets?limit=${limit}`;
  const out = [];

  while (url) {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    console.log("Plans" , data)
    if (Array.isArray(data?.results)) out.push(...data.results);

    const next = data?.pagination?.nextUrl;
    if (!next) break;
    url = next.startsWith("http")
      ? next
      : `https://developer.api.autodesk.com${next}`;
  }

  return out;
}

module.exports = { fetchProjectSheets, normalizeAccProjectId };