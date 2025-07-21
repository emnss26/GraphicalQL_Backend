const axios = require("axios");

const { fetchProjects } = require("../../libs/aec/aec.get.project.js");

const GetAECProjects = async (req, res) => {
  try {
    const token = req.cookies["access_token"];

    if (!token) {
      return res.status(401).json({ data: null, error: "No token provided", message: "Authorization token is required" });
    }

    const hubId = process.env.HUBAECID;

    const projects = await fetchProjects(token, hubId);
    //console.log(`📁 Projects for hub ${hubId}:`, projects);

    return res.status(200).json({
      data: {
        aecProjects: projects,
      },
      error: null,
      message: "Hubs, projects and models retrieved successfully",
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
  GetAECProjects,
};
