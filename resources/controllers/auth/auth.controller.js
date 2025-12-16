const axios = require("axios");

const {
  GetAPSThreeLeggedToken,
  GetAPSToken,
} = require("../../../utils/auth_utils/auth.utils");

const frontendUrl = process.env.FRONTEND_URL;

const GetThreeLegged = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ success: false, message: "Authorization code is required", data: null, error: "ValidationError" });
  }

  try {
    const token = await GetAPSThreeLeggedToken(code);

    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to retrieve APS token", data: null, error: "TokenRetrievalFailed" });
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
    console.error("Error in GetThreeLegged:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to get APS three-legged token", data: null, error: "TokenRetrievalFailed" });
  }
};

const GetToken = async (req, res) => {
  try {
    const token = await GetAPSToken();

    if (!token) {
      return res.status(500).json({ success: false, message: "Failed to retrieve APS token", data: null, error: "TokenRetrievalFailed" });
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
    res.status(500).json({
      success: false,
      message: "Token error",
      data: null,
      error: error.message,
    });
  }
};

const PostLogout = async (req, res) => {
  try {
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });
    res.status(200).json({ success: true, message: "Logged out", data: null, error: null });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error logging out",
      data: null,
      error: error.message,
    });
  }
};

module.exports = {
  GetThreeLegged,
  GetToken,
  PostLogout
};
