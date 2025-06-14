const axios = require("axios");

const GetGraphicalQlHubs = async (req, res) => {
  try {
    const token = req.cookies["access_token"];

    if (!token) {
      return res.status(401).json({
        data: null,
        error: "No token provided",
        message: "Authorization token is required",
      });
    }

    const { data: hubsData } = await axios({
      method: "POST",
      url: "https://developer.api.autodesk.com/aec/graphql",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        query: `
            {
              hubs {
                results {
                  name
                  id
                }
              }
            }
          `,
      },
    });

    console.log("Hubs Data:", hubsData.data.hubs.results);

    res.status(200).json({
      data: {
        hubs: hubsData.data.hubs.results,
      },
      error: null,
      message: "Hubs retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching hubs:", error);
    res.status(500).json({
      data: null,
      error: error.message,
      message: "Failed to retrieve hubs",
    });
  }
};

module.exports = {
  GetGraphicalQlHubs,
};
