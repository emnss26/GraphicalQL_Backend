const axios = require("axios");

async function fetchDataManagementHubs(token) {
  try {
    const { data } = await axios.get(
      "https://developer.api.autodesk.com/project/v1/hubs",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data.data || [];
  } catch (error) {
    console.error("Error fetching Data Management hubs:", error);
    throw error;
  }
}

module.exports = {
  fetchDataManagementHubs
};
