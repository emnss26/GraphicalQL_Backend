const axios = require("axios");

const {
  GetAPSThreeLeggedToken,
  GetAPSToken,
} = require("../../../utils/auth_utils/auth.utils");

const frontendUrl = process.env.FRONTEND_URL;

const GetThreeLegged = async (req, res, next) => {
  const { code } = req.query;

  if (!code) {
    const error = new Error("Authorization code is required");
    error.status = 400;
    error.code = "ValidationError";
    return next(error);
  }

  try {
    const token = await GetAPSThreeLeggedToken(code);

    if (!token) {
      const error = new Error("Failed to retrieve APS token");
      error.status = 500;
      error.code = "TokenRetrievalFailed";
      return next(error);
    }

    const isDev = process.env.NODE_ENV !== "production";

    res.cookie("access_token", token.access_token, {
      maxAge: 3600000,
      httpOnly: true,
      secure: !isDev ? true : false, // desactiva secure en dev
      sameSite: !isDev ? "None" : "Lax", // usa Lax en local
      path: "/",
    });

    res.cookie("refresh_token", token.refresh_token, {
      httpOnly: true,
      secure: !isDev ? true : false,
      sameSite: !isDev ? "None" : "Lax",
      path: "/",
    });

    console.log("Three-legged token set in cookies.");

    

    return res.redirect(`${frontendUrl}/aec-projects`);
  } catch (error) {
    error.code = error.code || "TokenRetrievalFailed";
    return next(error);
  }
};

const GetToken = async (req, res, next) => {
  try {
    const token = await GetAPSToken();

    if (!token) {
      const error = new Error("Failed to retrieve APS token");
      error.status = 500;
      error.code = "TokenRetrievalFailed";
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: "Token generated correctly",
      data: {
        access_token: token,
      },
      error: null,
    });
  } catch (error) {
    error.code = error.code || "TokenError";
    return next(error);
  }
};

const PostLogout = async (req, res, next) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
    res.status(200).json({ success: true, message: "Logged out", data: null, error: null });
  } catch (error) {
    error.code = error.code || "LogoutError";
    return next(error);
  }
};

module.exports = {
  GetThreeLegged,
  GetToken,
  PostLogout
};
