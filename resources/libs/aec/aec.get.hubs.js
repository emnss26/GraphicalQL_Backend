const axios = require("axios");

async function fetchHubs(token) {
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
          hubs { results { id name } }
        }
      `,
    },
  });
  return data.data.hubs.results;
}

module.exports = { fetchHubs };