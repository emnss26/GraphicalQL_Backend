const axios = require("axios")

const AUTODESK_BASE_URL = String(
  process.env.AUTODESK_BASE_URL || "https://developer.api.autodesk.com"
).replace(/\/+$/, "")

async function fetchAccProjectUsers(token, projectId) {
  if (!token) throw new Error("Missing APS access token")
  if (!projectId) throw new Error("Missing projectId")

  const cleanProjectId = String(projectId).replace(/^b\./, "").trim()
  const baseUrl = `${AUTODESK_BASE_URL}/construction/admin/v1/projects/${cleanProjectId}/users`
  const params = {
    limit: 200,
    offset: 0,
  }
  const headers = {
    Authorization: `Bearer ${token}`,
  }
  const users = []

  while (true) {
    const { data } = await axios.get(baseUrl, { headers, params })
    const results = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : []

    users.push(...results)

    const nextUrl = data?.pagination?.nextUrl
    if (!nextUrl) break

    try {
      const parsed = new URL(nextUrl)
      const nextOffset = parsed.searchParams.get("offset")
      const nextLimit = parsed.searchParams.get("limit")

      if (nextLimit) params.limit = Number(nextLimit)
      params.offset = nextOffset ? Number(nextOffset) : params.offset + params.limit
    } catch (_err) {
      params.offset += params.limit
    }
  }

  return users
}

module.exports = { fetchAccProjectUsers }
