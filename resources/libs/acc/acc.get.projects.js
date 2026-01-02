const axios = require("axios")

/**
 * Fetch ACC/Data Management projects for a hub using pagination.
 *
 * @param {string} token APS access token
 * @param {string} hubId Data Management hub id (e.g., "b.xxxx...")
 * @returns {Promise<Array>}
 */
async function fetchAccProjects(token, hubId) {
  if (!token) throw new Error("Missing APS access token")
  if (!hubId) throw new Error("Missing hubId")

  const projects = []
  let nextUrl = `https://developer.api.autodesk.com/project/v1/hubs/${encodeURIComponent(
    hubId
  )}/projects`

  try {
    while (nextUrl) {
      const { data } = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (Array.isArray(data?.data)) projects.push(...data.data)

      nextUrl = data?.links?.next?.href || null
    }

    return projects
  } catch (error) {
    console.error(
      "Error fetching ACC projects:",
      error?.response?.data || error?.message || error
    )
    throw error
  }
}

module.exports = { fetchAccProjects }
