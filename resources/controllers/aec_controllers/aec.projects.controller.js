const { fetchProjects } = require("../../libs/aec/aec.get.project.js");
const { fetchHubs } = require("../../libs/aec/aec.get.hubs.js");

const HUBNAME = process.env.HUBNAME;

const GetAECProjects = async (req, res) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        data: null,
        error: "Unauthorized",
        message: "Authorization token is required"
      });
    }

    const hubs = await fetchHubs(token);
    //console.log("🔍 Available Hubs:", hubs.map(h => h.name).join(", "));

    const matchedHub = hubs.find(hub => hub.name === HUBNAME);
    if (!matchedHub) {
      return res.status(404).json({
        data: null,
        error: "HubNotFound",
        message: `No hub found with the name: ${HUBNAME}`
      });
    }

    const matchedHubId = matchedHub.id;
    const projects = await fetchProjects(token, matchedHubId);

    return res.status(200).json({
      data: { aecProjects: projects },
      error: null,
      message: "Projects retrieved successfully"
    });
  } catch (error) {
    console.error("❌ Error in GetAECProjects:", error);
    return res.status(500).json({
      data: null,
      error: error.message,
      message: "Internal server error while retrieving AEC projects"
    });
  }
};

module.exports = { GetAECProjects };