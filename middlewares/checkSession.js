const axios = require("axios")
const config = require("../config")
const { verifyAPSToken } = require("../utils/auth_utils/jwt.utils")

const APS_AUTH_BASE = String(
  process.env.AUTODESK_BASE_URL || "https://developer.api.autodesk.com"
).replace(/\/+$/, "")
const APS_TOKEN_URL = `${APS_AUTH_BASE}/authentication/v2/token`

async function checkSession(req, res, next) {
  const accessToken = req.cookies?.access_token
  const refreshToken = req.cookies?.refresh_token
  const isProduction = config.env === "production"
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "None" : "Lax",
    path: "/",
  }

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ message: "No active session. Please log in." })
  }

  try {
    if (accessToken) {
      try {
        const decoded = await verifyAPSToken(accessToken)

        if (decoded?.exp) {
          const now = Math.floor(Date.now() / 1000)
          const safetyMarginSeconds = 10

          if (decoded.exp > now + safetyMarginSeconds) {
            req.user = decoded
            return next()
          }
        }
      } catch (tokenError) {
        if (!isProduction) {
          console.warn("Access token invalid, attempting refresh:", tokenError.message)
        }
      }
    }

    if (refreshToken) {
      if (!isProduction) {
        console.log("Session token expired or missing. Attempting refresh...")
      }

      const params = new URLSearchParams()
      params.append("client_id", config.aps.clientId)
      params.append("client_secret", config.aps.clientSecret)
      params.append("grant_type", "refresh_token")
      params.append("refresh_token", refreshToken)

      const response = await axios.post(APS_TOKEN_URL, params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })

      const { access_token: newAccessToken, refresh_token: newRefreshToken } = response.data

      res.cookie("access_token", newAccessToken, { ...cookieOptions, maxAge: 3600000 })

      if (newRefreshToken) {
        res.cookie("refresh_token", newRefreshToken, cookieOptions)
      }

      req.cookies.access_token = newAccessToken
      if (newRefreshToken) req.cookies.refresh_token = newRefreshToken

      req.user = await verifyAPSToken(newAccessToken)
      return next()
    }

    return res.status(401).json({ message: "Session expired. Please log in again." })
  } catch (err) {
    if (isProduction) {
      console.error("Session refresh failed")
    } else {
      console.error("Session refresh failed:", err.response?.data || err.message)
    }

    res.clearCookie("access_token", cookieOptions)
    res.clearCookie("refresh_token", cookieOptions)

    return res.status(401).json({ message: "Invalid session. Please log in." })
  }
}

module.exports = checkSession
