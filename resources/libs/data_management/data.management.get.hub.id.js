const axios = require("axios");

/**
 * Fetches a specific Data Management hub by its ID.
 *
 * @param {string} token - APS access token.
 * @param {string} hubId - Unique ID of the hub to retrieve.
 * @returns {Promise<Object>} - Hub data object.
 * @throws {Error} - If the request fails.
 */
async function fetchDataManagementHubId(token, hubId) {
  try {
    const { data } = await axios.get(
      `https://developer.api.autodesk.com/project/v1/hubs/${hubId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return data.data || {};
  } catch (error) {
    console.error("Error fetching Data Management hub:", error);
    throw error;
  }
}

module.exports = {
  fetchDataManagementHubId
};