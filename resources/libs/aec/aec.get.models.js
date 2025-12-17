const axios = require("axios");

/**
 * Fetches element groups (models) associated with a given AEC project.
 *
 * @param {string} token - APS access token.
 * @param {string} projectId - AEC project ID.
 * @returns {Promise<Array>} - List of models (element groups) with metadata.
 */
async function fetchModels(token, projectId) {
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
          query GetElementGroupsByProject($projectId: ID!) {
            elementGroupsByProject(projectId: $projectId) {
              pagination {
                cursor
              }
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
        `,
        variables: { projectId },
      },
    });
    console.log("Models fetched:", data?.data?.elementGroupsByProject?.results);

    return data?.data?.elementGroupsByProject?.results || [];


  } catch (error) {
    console.error("Error fetching AEC models:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchModels };