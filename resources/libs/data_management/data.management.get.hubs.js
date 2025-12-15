const axios = require("axios");

/**
 * Fetches hubs from Autodesk Data Management API.
 *
 * @param {string} token - APS access token.
 * @returns {Promise<Array>} - Array of hub objects.
 */
async function fetchDataManagementHubs(token) {
  try {
    const { data } = await axios.get(
      "https://developer.api.autodesk.com/project/v1/hubs",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    return data.data || [];
  } catch (error) {
    console.error("Error fetching Data Management hubs:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  fetchDataManagementHubs
};