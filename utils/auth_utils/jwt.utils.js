const jwt = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");

const APS_JWKS_URI =
  process.env.APS_JWKS_URI || "https://developer.api.autodesk.com/authentication/v2/keys";
const APS_ISSUER = process.env.APS_ISSUER || "https://developer.api.autodesk.com";
const APS_CLIENT_ID = process.env.APS_CLIENT_ID || "";
const APS_API_AUDIENCE = process.env.APS_API_AUDIENCE || "https://developer.api.autodesk.com";
const APS_VERIFY_AUDIENCE =
  String(process.env.APS_VERIFY_AUDIENCE || "false").toLowerCase() === "true";

const jwksClient = jwksRsa({
  jwksUri: APS_JWKS_URI,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 60 * 60 * 1000,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
  timeout: 30000,
});

function getSigningKey(header, callback) {
  if (!header?.kid) {
    callback(new Error("Missing token kid"), null);
    return;
  }

  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err, null);
      return;
    }

    const signingKey =
      (typeof key?.getPublicKey === "function" && key.getPublicKey()) ||
      key?.publicKey ||
      key?.rsaPublicKey ||
      null;

    if (!signingKey) {
      callback(new Error("Missing signing key"), null);
      return;
    }

    callback(null, signingKey);
  });
}

function hasValidAudience(decoded) {
  const allowed = new Set(
    [APS_CLIENT_ID, APS_API_AUDIENCE].map((v) => String(v || "").trim()).filter(Boolean)
  );

  if (!allowed.size) return true;

  const audClaim = decoded?.aud;
  const audiences = Array.isArray(audClaim) ? audClaim : [audClaim];
  const normalized = audiences.map((v) => String(v || "").trim()).filter(Boolean);

  // Some APS tokens may omit `aud`; keep backward compatibility unless strict mode is required.
  if (!normalized.length) return true;

  return normalized.some((aud) => allowed.has(aud));
}

/**
 * Validate Autodesk JWT using signature + claim checks.
 * @param {string} token
 * @returns {Promise<Object>}
 */
async function verifyAPSToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token: Invalid token format");
  }

  const verifyOptions = {
    algorithms: ["RS256"],
    issuer: APS_ISSUER,
    clockTolerance: 10,
  };

  return new Promise((resolve, reject) => {
    jwt.verify(token, getSigningKey, verifyOptions, (error, decoded) => {
      if (error) {
        if (error.name === "TokenExpiredError") {
          reject(new Error("Token has expired"));
          return;
        }
        reject(new Error("Invalid token: " + error.message));
        return;
      }

      if (APS_VERIFY_AUDIENCE && !hasValidAudience(decoded)) {
        reject(new Error("Invalid token: jwt audience invalid"));
        return;
      }

      resolve(decoded);
    });
  });
}

module.exports = { verifyAPSToken };
