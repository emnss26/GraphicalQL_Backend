const axios = require('axios');

const APS_BASE = process.env.AUTODESK_BASE_URL || 'https://developer.api.autodesk.com';

const GetUserProfile = async (req, res) => {
  try {
    const token = req.cookies['access_token'];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Missing access token', data: null, error: 'Unauthorized' });
    }

    const { data } = await axios.get(`${APS_BASE}/userprofile/v1/users/@me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = {
      id: data.userId || data.uid || null,
      email: data.emailId || data.email || null,
      name:
        data.displayName ||
        data.userName ||
        `${data.firstName || ''} ${data.lastName || ''}`.trim(),
      raw: data, // remove if raw response is not needed on frontend
    };

    res.set('Cache-Control', 'no-store'); // prevent caching
    return res.status(200).json({ success: true, message: 'User profile retrieved', data: payload, error: null });
  } catch (error) {
    const status = error?.response?.status || 500;

    if (status === 401) {
      return res.status(401).json({ success: false, message: 'Token expired or invalid', data: null, error: 'Unauthorized' });
    }

    console.error('Error fetching user profile:', error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || 'Error fetching user profile',
      data: null,
      error: 'ProfileFetchFailed',
    });
  }
};

module.exports = { GetUserProfile };