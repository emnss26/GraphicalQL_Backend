const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');

async function checkSession(req, res, next) {
  // 1. Obtener tokens
  let accessToken = req.cookies?.access_token;
  const refreshToken = req.cookies?.refresh_token;

  if (!accessToken && !refreshToken) {
    return res.status(401).json({ message: 'No active session. Please log in.' });
  }

  try {
    // 2. Verificar validez temporal del Access Token (si existe)
    if (accessToken) {
      const decoded = jwt.decode(accessToken);
      
      if (decoded && decoded.exp) {
        const nowInSeconds = Math.floor(Date.now() / 1000);
        // Margen de seguridad de 10 segundos para evitar fallos en el borde de expiración
        if (decoded.exp > (nowInSeconds + 10)) {
          req.user = decoded;
          return next(); // Token válido y vivo. Pasamos.
        }
      }
    }

    // 3. Si llegamos aquí, el Access Token no existe o expiró. Usamos Refresh Token.
    if (refreshToken) {
      console.log("Session: Token expired or missing. Attempting refresh...");

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

      const { access_token: newAccessToken, refresh_token: newRefreshToken } = response.data;

      // Configuración de seguridad para cookies (Producción vs Desarrollo)
      const isProduction = process.env.NODE_ENV === "production";
      const cookieOptions = {
        httpOnly: true,
        secure: isProduction, // HTTPS obligatorio en producción
        sameSite: isProduction ? 'None' : 'Lax', // Permite cross-site en prod
        path: '/' 
      };

      // Guardamos cookies en el navegador
      res.cookie('access_token', newAccessToken, { ...cookieOptions, maxAge: 3600000 }); // 1h
      
      if (newRefreshToken) {
        res.cookie('refresh_token', newRefreshToken, cookieOptions);
      }

      // CRÍTICO: Actualizamos el request actual para que los controladores siguientes
      // usen el token nuevo y no fallen con el viejo.
      req.cookies.access_token = newAccessToken;
      if (newRefreshToken) req.cookies.refresh_token = newRefreshToken;
      
      req.user = jwt.decode(newAccessToken);
      
      return next();
    }

    // Si no hay refresh token válido
    return res.status(401).json({ message: 'Session expired. Please log in again.' });

  } catch (err) {
    console.error('Session Refresh Failed:', err.response?.data || err.message);
    
    // Si falla el refresh (token revocado o inválido), borramos cookies para forzar login limpio
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    
    return res.status(401).json({ message: 'Invalid session. Please log in.' });
  }
}

module.exports = checkSession;