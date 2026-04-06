const axios = require("axios")

const APS_BASE =
  process.env.AUTODESK_BASE_URL || "https://developer.api.autodesk.com"

const fetchAuthenticatedUserProfile = async (token) => {
  if (!token) {
    const err = new Error("Missing access token")
    err.status = 401
    err.code = "Unauthorized"
    throw err
  }

  const { data } = await axios.get(`${APS_BASE}/userprofile/v1/users/@me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return data
}

const buildUserProfilePayload = (data = {}) => {
  const name =
    data.displayName ||
    data.userName ||
    `${data.firstName || ""} ${data.lastName || ""}`.trim()

  return {
    id: data.userId || data.uid || null,
    email: data.emailId || data.email || null,
    name: name || null,
  }
}

const GetUserProfile = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token

    const data = await fetchAuthenticatedUserProfile(token)

    //console.log("User profile data:", data)

    const payload = buildUserProfilePayload(data)

    // Prevent caching sensitive profile data
    res.set("Cache-Control", "no-store")

    return res.status(200).json({
      success: true,
      message: "User profile retrieved",
      data: payload,
      error: null,
    })
  } catch (err) {
    const status = err?.response?.status || 500

    if (status === 401) {
      err.status = 401
      err.code = "Unauthorized"
      err.message = "Token expired or invalid"
      return next(err)
    }

    err.code = err.code || "ProfileFetchFailed"
    return next(err)
  }
}

module.exports = {
  GetUserProfile,
  fetchAuthenticatedUserProfile,
  buildUserProfilePayload,
}
