const axios = require("axios")
const crypto = require("crypto")
const config = require("../../../config")

const {
  GetAPSThreeLeggedToken,
} = require("../../../utils/auth_utils/auth.utils")

const OAUTH_STATE_COOKIE = "oauth_state"
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000

const buildCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production"

  return {
    httpOnly: true,
    secure: isProduction, // HTTPS required in production
    sameSite: isProduction ? "None" : "Lax", // allow cross-site cookies in prod
    path: "/",
  }
}

const GetThreeLegged = async (req, res, next) => {
  const { code, state } = req.query
  const cookieOptions = buildCookieOptions()
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE]

  if (!code) {
    const err = new Error("Authorization code is required")
    err.status = 400
    err.code = "ValidationError"
    return next(err)
  }

  if (!state || !expectedState || String(state) !== String(expectedState)) {
    res.clearCookie(OAUTH_STATE_COOKIE, cookieOptions)
    const err = new Error("Invalid OAuth state")
    err.status = 400
    err.code = "InvalidOAuthState"
    return next(err)
  }

  try {
    const token = await GetAPSThreeLeggedToken(code)

    if (!token) {
      const err = new Error("Failed to retrieve APS token")
      err.status = 500
      err.code = "TokenRetrievalFailed"
      return next(err)
    }

    res.cookie("access_token", token.access_token, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1h
    })

    res.cookie("refresh_token", token.refresh_token, cookieOptions)
    res.clearCookie(OAUTH_STATE_COOKIE, cookieOptions)
    //console.log("Three-legged token set in cookies.")

    return res.redirect(`${config.frontendUrl}/aec-projects`)
  } catch (err) {
    err.code = err.code || "TokenRetrievalFailed"
    return next(err)
  }
}

const GetToken = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token

    if (!token) {
      const err = new Error("Missing access token")
      err.status = 401
      err.code = "Unauthorized"
      return next(err)
    }

    res.set("Cache-Control", "no-store")

    return res.status(200).json({
      success: true,
      message: "Token generated correctly",
      data: { access_token: token },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "TokenError"
    return next(err)
  }
}

const GetOAuthState = async (_req, res, next) => {
  try {
    const cookieOptions = buildCookieOptions()
    const state = crypto.randomBytes(24).toString("hex")

    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: OAUTH_STATE_MAX_AGE_MS,
    })

    res.set("Cache-Control", "no-store")

    return res.status(200).json({
      success: true,
      message: "OAuth state generated",
      data: { state },
      error: null,
    })
  } catch (err) {
    err.code = err.code || "OAuthStateError"
    return next(err)
  }
}

const PostLogout = async (req, res, next) => {
  try {
    const cookieOptions = buildCookieOptions()

    // Keep behavior compatible: in production this clears secure/None cookies;
    // in dev it clears Lax/non-secure cookies as well.
    res.clearCookie("access_token", cookieOptions)
    res.clearCookie("refresh_token", cookieOptions)
    res.clearCookie(OAUTH_STATE_COOKIE, cookieOptions)

    return res.status(200).json({
      success: true,
      message: "Logged out",
      data: null,
      error: null,
    })
  } catch (err) {
    err.code = err.code || "LogoutError"
    return next(err)
  }
}

module.exports = {
  GetOAuthState,
  GetThreeLegged,
  GetToken,
  PostLogout,
}
