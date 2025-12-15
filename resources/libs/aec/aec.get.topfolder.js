const axios = require("axios");

/**
 * Fetches the top-level folders for a given AEC project using GraphQL.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - AEC project ID.
 * @returns {Promise<Array>} - List of top-level folder objects.
 */
async function fetchTopFoldersGraphql(token, projectId) {
  try {
    const response = await axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/aec/graphql",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        query: `
          query GetFoldersByProject($projectId: ID!) {
            foldersByProject(projectId: $projectId) {
              results {
                id
                name
                objectCount
              }
            }
          }
        `,
        variables: { projectId }
      },
    });

    return response.data?.data?.foldersByProject?.results || [];
  } catch (error) {
    console.error("Error fetching top-level folders:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchTopFoldersGraphql };