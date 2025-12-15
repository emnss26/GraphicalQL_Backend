const axios = require("axios");

/**
 * Fetches all ACC projects under a given account (hub).
 * 
 * @param {string} token - APS access token
 * @param {string} accountId - Hub/account ID (e.g. urn:adsk.ace:prod.scope:...)
 * @returns {Promise<Array>} - List of ACC projects
 */
async function fetchAccProjects(token, accountId) {
  if (!token) {
    throw new Error("No token provided");
  }
  if (!accountId) {
    throw new Error("No accountId provided");
  }

  try {
    const { data } = await axios.get(
      `https://developer.api.autodesk.com/project/v1/hubs/${accountId}/projects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return data.data || [];
  } catch (error) {
    console.error("Error fetching ACC projects:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = {
  fetchAccProjects,
};