const axios = require("axios");

async function fetchHubs(token) {
    const { data} = await axios.get("https://developer.api.autodesk.com/project/v1/hubs",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return data.data.hubs || [];
}

module.exports = {
  fetchHubs,
};