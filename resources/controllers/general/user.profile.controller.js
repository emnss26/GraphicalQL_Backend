const axios = require("axios");

const APS_BASE = process.env.AUTODESK_BASE_URL || "https://developer.api.autodesk.com";

const GetUserProfile = async (req, res) => {
  try {
    const token = req.cookies["access_token"];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing access token" });
    }

    const { data } = await axios.get(`${APS_BASE}/userprofile/v1/users/@me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    //console.log ("User", data)

    // Respuesta típica APS: emailId, userName, displayName, userId, ...
    const payload = {
      id: data.userId || data.uid || null,
      email: data.emailId || data.email || null,
      name: data.displayName || data.userName || `${data.firstName || ""} ${data.lastName || ""}`.trim(),
      raw: data, // si no quieres enviarlo, elimínalo
    };

    // Evita cache en gateways/proxies
    res.set("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (error) {
    const status = error?.response?.status || 500;
    // Si APS devolvió 401 por token expirado, propaga 401 al front
    if (status === 401) {
      return res.status(401).json({ error: "Unauthorized", message: "Token expired/invalid" });
    }
    console.error("Error fetching user profile:", error?.message || error);
    return res.status(500).json({
      error: "ProfileFetchFailed",
      message: error?.message || "Error fetching user profile",
    });
  }
};

module.exports = { GetUserProfile };