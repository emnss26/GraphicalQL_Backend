const { fetchProjects } = require("../../libs/aec/aec.get.project.js");
const { fetchHubs } = require("../../libs/aec/aec.get.hubs.js");

const HUBNAME = process.env.HUBNAME;

const GetAECProjects = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      const error = new Error("Authorization token is required");
      error.status = 401;
      error.code = "Unauthorized";
      return next(error);
    }

    const hubs = await fetchHubs(token);

    const matchedHub = hubs.find(hub => hub.name === HUBNAME);
    if (!matchedHub) {
      const error = new Error(`No hub found with the name: ${HUBNAME}`);
      error.status = 404;
      error.code = "HubNotFound";
      return next(error);
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
    error.code = error.code || "AECProjectsFetchFailed";
    return next(error);
  }
};

module.exports = { GetAECProjects };
