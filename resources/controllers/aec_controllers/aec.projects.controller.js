const { fetchProjects } = require("../../libs/aec/aec.get.project.js");
const { fetchHubs } = require("../../libs/aec/aec.get.hubs.js");

const HUBNAME = process.env.HUBNAME;

const GetAECProjects = async (req, res) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required",
        data: null,
        error: "Unauthorized"
      });
    }

    const hubs = await fetchHubs(token);

    const matchedHub = hubs.find(hub => hub.name === HUBNAME);
    if (!matchedHub) {
      return res.status(404).json({
        success: false,
        message: `No hub found with the name: ${HUBNAME}`,
        data: null,
        error: "HubNotFound"
      });
    }

    const matchedHubId = matchedHub.id;
    const projects = await fetchProjects(token, matchedHubId);

    return res.status(200).json({
      success: true,
      message: "Projects retrieved successfully",
      data: { aecProjects: projects },
      error: null
    });
  } catch (error) {
    console.error("❌ Error in GetAECProjects:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while retrieving AEC projects",
      data: null,
      error: error.message
    });
  }
};

module.exports = { GetAECProjects };
