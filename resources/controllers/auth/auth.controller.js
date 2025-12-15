const axios = require("axios");

const {
  GetAPSThreeLeggedToken,
  GetAPSToken,
} = require("../../../utils/auth_utils/auth.utils");

const frontendUrl = process.env.FRONTEND_URL;

const GetThreeLegged = async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Authorization code is required" });
  }

  try {
    const token = await GetAPSThreeLeggedToken(code);

    if (!token) {
      return res.status(500).json({ error: "Failed to retrieve APS token" });
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
      .json({ error: "Failed to get APS three-legged token" });
  }
};

const GetToken = async (req, res) => {
  try {
    const token = await GetAPSToken();

    if (!token) {
      return res.status(500).json({ error: "Failed to retrieve APS token" });
    }

    res.status(200).json({
      data: {
        access_token: token,
      },
      error: null,
      message: "Token generated correctly",
    });
  } catch (error) {
    res.status(500).json({
  data: null,
  error: error.message,
  message: "Token error",
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
    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    res.status(500).json({
      message: "Error logging out",
      error: error.message,
    });
  }
};

module.exports = {
  GetThreeLegged,
  GetToken,
  PostLogout
};
