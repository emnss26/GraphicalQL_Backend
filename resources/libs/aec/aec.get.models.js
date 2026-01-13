const axios = require("axios")

const AEC_GRAPHQL_URL = "https://developer.api.autodesk.com/aec/graphql"

/**
 * Fetch element groups (models) for a given AEC project.
 * Uses cursor-based pagination until no cursor is returned.
 *
 * @param {string} token APS access token
 * @param {string} projectId AEC project ID
 * @returns {Promise<Array>} List of element groups (models)
 */
async function fetchModels(token, projectId) {
  if (!token) throw new Error("Missing APS access token")
  if (!projectId) throw new Error("Missing projectId")

  console.log("ProjectId", projectId)
  const query = `
    query GetElementGroupsByProject($projectId: ID!, $cursor: String) {
      elementGroupsByProject(projectId: $projectId, pagination: { cursor: $cursor }) {
        pagination { cursor pageSize }
        results {
          name
          id
          alternativeIdentifiers {
            fileUrn
            fileVersionUrn
          }
        }
      }
    }
  `

  const results = []
  let cursor = null

  try {
    while (true) {
      const { data } = await axios.post(
        AEC_GRAPHQL_URL,
        { query, variables: { projectId, cursor } },
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

      const payload = data?.data?.elementGroupsByProject
      const page = payload?.results || []
      if (page.length) results.push(...page)

      cursor = payload?.pagination?.cursor || null
      if (!cursor) break
    }

    return results
  } catch (error) {
    console.error("Error fetching AEC models:", error?.response?.data || error?.message || error)
    throw error
  }
}

module.exports = { fetchModels }
