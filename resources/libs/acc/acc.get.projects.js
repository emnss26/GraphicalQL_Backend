const axios = require("axios");

async function fetchaccprojects (token, accountId) {
  try {
    //console.log("Fetching ACC projects for account:", accountId);
    if (!token) {
        throw new Error("No token provided");
        }
    if (!accountId) {
        throw new Error("No accountId provided");
        }
    //console.log("Using token:", token);

    const { data } = await axios.get(
      `https://developer.api.autodesk.com/project/v1/hubs/${accountId}/projects`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    //console.log("Fetched ACC projects:", data);

    return data.data;
  } catch (error) {
    console.error("Error fetching ACC projects:", error);
    throw error;
  }
}

module.exports = {
  fetchaccprojects
};
