const axios = require("axios");

/**
 * Fetches all AEC projects from a specified hub via Autodesk GraphQL API.
 *
 * @param {string} token - APS access token.
 * @param {string} hubId - Hub identifier (ACC account ID).
 * @returns {Promise<Array>} - List of projects in the hub.
 */
async function fetchProjects(token, hubId) {
  try {
    const { data } = await axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/aec/graphql",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        query: `
          query GetProjects($hubId: ID!) {
            projects(hubId: $hubId) {
              pagination {
                cursor
              }
              results {
                id
                name
                alternativeIdentifiers {
                  dataManagementAPIProjectId
                }
              }
            }
          }
        `,
        variables: { hubId },
      },
    });

    return data?.data?.projects?.results || [];
  } catch (error) {
    console.error("Error fetching AEC projects:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchProjects };