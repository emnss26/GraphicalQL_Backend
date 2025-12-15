const axios = require("axios");

/**
 * Fetches elements from a model's element group filtered by property string.
 * Typically used to extract sheet-related data from models.
 *
 * @param {string} token - APS access token
 * @param {string} elementGroupId - ID of the element group
 * @param {string} propertyFilter - GraphQL filter string for properties
 * @returns {Promise<Array>} - Array of elements with properties
 */
async function fetchSheets(token, elementGroupId, propertyFilter) {
  try {
    const { data } = await axios({
      method: 'POST',
      url: 'https://developer.api.autodesk.com/aec/graphql',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        query: `
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
                      units {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: {
          elementGroupId,
          propertyFilter
        },
      },
    });

    return data?.data?.elementsByElementGroup?.results || [];
  } catch (error) {
    console.error("Error fetching model sheets:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchSheets };