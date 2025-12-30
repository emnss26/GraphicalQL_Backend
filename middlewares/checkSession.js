const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');

async function checkSession(req, res, next) {
  const accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken && !refreshToken) {
     // Si no hay ninguno de los dos, fuera.
    return res.status(401).json({ message: 'No session. Please log in.' });
  }

  try {
    // 1. Intentamos verificar el Access Token actual
    if (accessToken) {
        const decoded = jwt.decode(accessToken);
        // Verificar si existe decoded y si tiene exp
        if (decoded && decoded.exp) {
            const isExpired = decoded.exp < Math.floor(Date.now() / 1000);
            if (!isExpired) {
                req.user = decoded;
                return next(); // Token válido, continuamos
            }
        }
    }

    // 2. Si llegamos aquí, el Access Token expiró o no existe. Usamos Refresh Token.
    if (refreshToken) {
      console.log("Access token expired/missing. Attempting refresh...");
      
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

      // IMPORTANTE: Autodesk devuelve access_token Y un nuevo refresh_token
      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Configuración de cookies (debe coincidir con auth.controller)
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // True en prod (HTTPS)
        sameSite: isProduction ? 'None' : 'Lax',
        path: '/' 
      };

      // Guardamos el nuevo Access Token
      res.cookie('access_token', access_token, { ...cookieOptions, maxAge: 3600000 }); // 1 hora

      // CORRECCIÓN: Guardamos TAMBIÉN el nuevo Refresh Token
      if (newRefreshToken) {
        res.cookie('refresh_token', newRefreshToken, cookieOptions);
      }

      req.user = jwt.decode(access_token);
      return next();
    }

    return res.status(401).json({ message: 'Session expired. Please log in again.' });

  } catch (err) {
    console.error('Auth check failed during refresh:', err.response?.data || err.message);
    return res.status(401).json({ message: 'Invalid session or refresh failed.' });
  }
}

module.exports = checkSession;