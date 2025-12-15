const axios = require("axios");

/**
 * Fetch list of AEC Hubs using the Autodesk GraphQL API.
 * @param {string} token - APS access token
 * @returns {Promise<Array>} - Array of hubs with id and name
 */
async function fetchHubs(token) {
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
          {
            hubs {
              results {
                id
                name
              }
            }
          }
        `,
      },
    });

    return data?.data?.hubs?.results || [];
  } catch (error) {
    console.error("Error fetching AEC hubs:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = { fetchHubs };