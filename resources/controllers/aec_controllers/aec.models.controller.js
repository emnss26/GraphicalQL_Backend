const { fetchModels } = require("../../libs/aec/aec.get.models.js");

const GetAECModels = async (req, res, next) => {
  const { projectId } = req.params;
  const token = req.cookies?.access_token;

  if (!token) {
    const error = new Error("Authorization token is required");
    error.status = 401;
    error.code = "Unauthorized";
    return next(error);
  }

  try {
    const models = await fetchModels(token, projectId);

    //console.log("Models fetched for project:", models);

    return res.status(200).json({
      success: true,
      message: "Models retrieved successfully",
      data: { models },
      error: null,
    });
  } catch (error) {
    error.code = error.code || "AECModelsFetchFailed";
    return next(error);
  }
};

module.exports = { GetAECModels };
