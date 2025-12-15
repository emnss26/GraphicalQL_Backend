const axios = require("axios");

/**
 * Fetches available Autodesk hubs for the authenticated user.
 * @param {string} token - APS access token
 * @returns {Promise<Array>} - List of hubs
 */
async function fetchHubs(token) {
  if (!token) {
    throw new Error("Access token is required to fetch hubs");
  }

  try {
    const { data } = await axios.get(
      "https://developer.api.autodesk.com/project/v1/hubs",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return data.data || [];
  } catch (error) {
    console.error("Error fetching hubs:", error.message);
    throw new Error("Failed to retrieve hubs");
  }
}

module.exports = {
  fetchHubs,
};