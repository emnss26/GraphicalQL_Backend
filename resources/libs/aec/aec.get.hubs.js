const axios = require("axios");

async function fetchHubs(token) {
  let allHubs = [];
  let cursor = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data } = await axios({
        method: "POST",
        url: "https://developer.api.autodesk.com/aec/graphql",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        data: {
          query: `
            query GetHubs($cursor: String) {
              hubs(pagination: { cursor: $cursor }) {
                pagination { cursor }
                results { id name }
              }
            }
          `,
          variables: { cursor }
        },
      });

      if (data.errors) throw new Error(data.errors[0].message);

      const results = data?.data?.hubs?.results || [];
      allHubs = [...allHubs, ...results];
      
      cursor = data?.data?.hubs?.pagination?.cursor;
      if (!cursor) hasMore = false;
    }
    return allHubs;
  } catch (error) {
    console.error("Error fetching AEC hubs:", error.message);
    throw error;
  }
}
module.exports = { fetchHubs };