const axios = require("axios")

const AEC_GRAPHQL_URL = "https://developer.api.autodesk.com/aec/graphql"

/**
 * Fetch AEC projects for a given hub via Autodesk AEC GraphQL.
 *
 * Note: This query returns a pagination cursor, but this implementation mirrors
 * the current behavior (single request) to avoid changing functionality.
 *
 * @param {string} token APS access token
 * @param {string} hubId AEC hub ID (urn:adsk.ace:...)
 * @returns {Promise<Array>} Projects list
 */
async function fetchProjects(token, hubId) {
  if (!token) throw new Error("Missing APS access token")
  if (!hubId) throw new Error("Missing hubId")

  const query = `
    query GetProjects($hubId: ID!) {
      projects(hubId: $hubId) {
        pagination { cursor }
        results {
          id
          name
          alternativeIdentifiers {
            dataManagementAPIProjectId
          }
        }
      }
    }
  `

  try {
    const { data } = await axios.post(
      AEC_GRAPHQL_URL,
      { query, variables: { hubId } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    const gqlErrors = data?.errors
    if (Array.isArray(gqlErrors) && gqlErrors.length) {
      throw new Error(gqlErrors[0]?.message || "AEC GraphQL error")
    }

    return data?.data?.projects?.results || []
  } catch (error) {
    console.error("Error fetching AEC projects:", error?.response?.data || error?.message || error)
    throw error
  }
}

module.exports = { fetchProjects }
