const axios = require("axios")

const AEC_GRAPHQL_URL = "https://developer.api.autodesk.com/aec/graphql"

/**
 * Fetch elements from an AEC element group using a property filter (GraphQL).
 *
 * @param {string} token APS access token
 * @param {string} elementGroupId AEC element group id (model id)
 * @param {string} propertyFilter GraphQL filter query (e.g. "property.name.category==Sheets")
 * @returns {Promise<Array>} GraphQL results array
 */
async function fetchSheets(token, elementGroupId, propertyFilter) {
  if (!token) throw new Error("Missing APS access token")
  if (!elementGroupId) throw new Error("Missing elementGroupId")
  if (!propertyFilter) throw new Error("Missing propertyFilter")

  const query = `
    query GetElementsFromCategory($elementGroupId: ID!, $propertyFilter: String!) {
      elementsByElementGroup(
        elementGroupId: $elementGroupId,
        filter: { query: $propertyFilter }
      ) {
        results {
          id
          name
          properties {
            results {
              name
              value
              definition {
                units { name }
              }
            }
          }
        }
      }
    }
  `

  try {
    const { data } = await axios.post(
      AEC_GRAPHQL_URL,
      { query, variables: { elementGroupId, propertyFilter } },
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

    return data?.data?.elementsByElementGroup?.results || []
  } catch (error) {
    console.error("Error fetching sheets:", error?.response?.data || error?.message || error)
    throw error
  }
}

module.exports = { fetchSheets }
