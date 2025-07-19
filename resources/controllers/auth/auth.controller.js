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

    res.cookie("access_token", token, {
      maxAge: 3600000,
      httpOnly: true,
      secure: true,
      sameSite: "None",
      path: "/",
    });

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

module.exports = {
  GetThreeLegged,
  GetToken,
};
