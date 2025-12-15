const axios = require("axios");

/**
 * Retrieves all review workflows for a given Autodesk Construction Cloud (ACC) project.
 * @param {string} token - APS access token
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - List of project reviews
 */
const GetProjectReviews = async (token, projectId) => {
  const url = `https://developer.api.autodesk.com/construction/reviews/v1/projects/${projectId}/reviews`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(url, { headers });
    return response.data.results;
  } catch (error) {
    console.error("Error fetching project reviews:", error.response?.data || error.message);
    throw new Error("Failed to fetch project reviews");
  }
};

module.exports = {
  GetProjectReviews,
};