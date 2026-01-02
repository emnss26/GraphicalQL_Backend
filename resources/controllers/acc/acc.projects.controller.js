const { fetchaccprojects } = require("../../libs/acc/acc.get.projects.js")
const { fetchDataManagementHubId } = require("../../libs/data_management/data.management.get.hub.id.js")

const GetProjects = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token
    if (!token) {
      const err = new Error("Access token is required")
      err.status = 401
      err.code = "Unauthorized"
      return next(err)
    }

    const rawHubId = process.env.RAWHUBID

    // Ensure hub is accessible/valid (side effects handled inside helper).
    await fetchDataManagementHubId(token, rawHubId)

    const accProjects = await fetchaccprojects(token, rawHubId)

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully",
      data: { accProjects },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "ACCProjectsFetchFailed"
    return next(err)
  }
}

module.exports = { GetProjects }
