const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');

async function checkSession(req, res, next) {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken) {
    return res.status(401).json({ success: false, message: 'No session. Please log in.', data: null, error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.decode(accessToken);
    const isExpired = decoded.exp < Math.floor(Date.now() / 1000);

    if (!isExpired) {
      req.user = decoded;
      return next();
    }

    // Attempt token refresh if access token is expired
    if (refreshToken) {
      const params = new URLSearchParams();
      params.append('client_id', config.aps.clientId);
      params.append('client_secret', config.aps.clientSecret);
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);

      const response = await axios.post(
        `${config.aps.baseUrl}/authentication/v2/token`,
        params,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const newToken = response.data.access_token;

      res.cookie('access_token', newToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      });

      req.user = jwt.decode(newToken);
      return next();
    }

    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.', data: null, error: 'Unauthorized' });

  } catch (err) {
    console.error('Auth check failed:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid session.', data: null, error: 'Unauthorized' });
  }
}

module.exports = checkSession;