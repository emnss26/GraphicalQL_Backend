const axios = require("axios")

const AUTODESK_BASE_URL = String(
  process.env.AUTODESK_BASE_URL || "https://developer.api.autodesk.com"
).replace(/\/+$/, "")

async function fetchAccProjectUserDetails(token, projectId, userId) {
  if (!token) throw new Error("Missing APS access token")
  if (!projectId) throw new Error("Missing projectId")
  if (!userId) throw new Error("Missing userId")

  const cleanProjectId = String(projectId).replace(/^b\./, "").trim()
  const cleanUserId = String(userId).trim()
  const url = `${AUTODESK_BASE_URL}/construction/admin/v1/projects/${cleanProjectId}/users/${encodeURIComponent(cleanUserId)}`

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return data
}

module.exports = { fetchAccProjectUserDetails }
