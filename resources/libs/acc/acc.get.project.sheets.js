const axios = require("axios")

/**
 * Normalize an ACC project identifier to a bare UUID.
 * Accepts:
 * - urn:adsk.workspace:prod.project:{uuid}
 * - b.{uuid}
 * - {uuid}
 *
 * @param {string} projectId
 * @returns {string}
 */
function normalizeAccProjectId(projectId) {
  const raw = String(projectId || "").trim()

  if (raw.startsWith("urn:adsk.workspace:prod.project:")) {
    return raw.split(":").pop()
  }

  return raw.replace(/^b\./i, "")
}

/**
 * Fetch all sheets (drawings) from ACC Sheets Index using pagination.
 *
 * @param {string} token APS access token
 * @param {string} projectId ACC project id (any supported format)
 * @param {number} limit Page size (default 200)
 * @returns {Promise<Array>}
 */
async function fetchProjectSheets(token, projectId, limit = 200) {
  const pid = normalizeAccProjectId(projectId)
  const results = []

  let url = `https://developer.api.autodesk.com/construction/sheets/v1/projects/${pid}/sheets?limit=${limit}`

  while (url) {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    if (Array.isArray(data?.results)) results.push(...data.results)

    const nextUrl = data?.pagination?.nextUrl
    if (!nextUrl) break

    url = nextUrl.startsWith("http")
      ? nextUrl
      : `https://developer.api.autodesk.com${nextUrl}`
  }

  return results
}

module.exports = {
  fetchProjectSheets,
  normalizeAccProjectId,
}
