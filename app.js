const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const config = require("./config");

const app = express();

const isProduction = config.env === "production";
const BASE_PATH = "/ControlPlanos";
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "50mb";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const toOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
};

const allowedFrontendOrigins = new Set(
  (config.frontendOrigins || []).map((origin) => toOrigin(origin)).filter(Boolean)
);

const apsOrigin =
  toOrigin(process.env.AUTODESK_BASE_URL || config.aps.baseUrl) ||
  "https://developer.api.autodesk.com";

const getRequestOrigin = (req) => {
  const originHeader = toOrigin(req.headers.origin);
  if (originHeader) return originHeader;
  return toOrigin(req.headers.referer);
};

const isAllowedFrontendOrigin = (origin) =>
  Boolean(origin) && allowedFrontendOrigins.has(origin);

// Fix for IIS/iisnode where req.ip may be undefined for some requests
const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return (
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown-ip"
  );
};

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: isProduction
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'self'"],
            baseUri: ["'self'"],
            connectSrc: ["'self'", apsOrigin],
            fontSrc: ["'self'", "data:"],
            formAction: ["'self'"],
            frameAncestors: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            objectSrc: ["'none'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            workerSrc: ["'self'", "blob:"],
            upgradeInsecureRequests: null,
          },
        }
      : false,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    validate: {
      ip: false,
    },
    keyGenerator: (req) => getClientIp(req),
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  })
);

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: JSON_BODY_LIMIT }));
app.use(cookieParser());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin header (server-to-server, health checks, etc.)
      if (!origin) return callback(null, true);

      const normalizedOrigin = toOrigin(origin);
      if (isAllowedFrontendOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
  })
);

// Exact origin validation for state-changing methods in production
app.use((req, res, next) => {
  if (isProduction && STATE_CHANGING_METHODS.has(req.method)) {
    const requestOrigin = getRequestOrigin(req);

    if (!isAllowedFrontendOrigin(requestOrigin)) {
      return res.status(403).json({
        success: false,
        message: "CSRF Protection: Origin not allowed",
      });
    }
  }

  return next();
});

if (!isProduction) {
  app.use(morgan("dev"));
}

app.disable("etag");

// Routers
const authRouter = require("./resources/routers/auth.router");
const aecRouter = require("./resources/routers/aec.router");
const accRouter = require("./resources/routers/acc.router");
const plansRouter = require("./resources/routers/plans.router");
const datamanagementRouter = require("./resources/routers/dm.router");

// Support both local routes and IIS subpath routes
app.use(["/auth", `${BASE_PATH}/auth`], authRouter);
app.use(["/aec", `${BASE_PATH}/aec`], aecRouter);
app.use(["/acc", `${BASE_PATH}/acc`], accRouter);
app.use(["/plans", `${BASE_PATH}/plans`], plansRouter);
app.use(["/dm", `${BASE_PATH}/dm`], datamanagementRouter);

// Health
app.get(["/health", `${BASE_PATH}/health`], (_req, res) => {
  res.json({
    success: true,
    message: "Backend API is online 🚀 (Express 4)",
    env: config.env,
  });
});

const publicPath = path.join(__dirname, "public");
const indexPath = path.join(publicPath, "index.html");

// Static frontend
app.use(express.static(publicPath));
app.use(BASE_PATH, express.static(publicPath));

// SPA fallback
app.get("*", (req, res, next) => {
  if (req.method !== "GET") return next();

  const requestPath = req.path || "";

  const isApiPath =
    requestPath.startsWith("/auth") ||
    requestPath.startsWith("/aec") ||
    requestPath.startsWith("/acc") ||
    requestPath.startsWith("/plans") ||
    requestPath.startsWith("/dm") ||
    requestPath.startsWith("/health") ||
    requestPath.startsWith(`${BASE_PATH}/auth`) ||
    requestPath.startsWith(`${BASE_PATH}/aec`) ||
    requestPath.startsWith(`${BASE_PATH}/acc`) ||
    requestPath.startsWith(`${BASE_PATH}/plans`) ||
    requestPath.startsWith(`${BASE_PATH}/dm`) ||
    requestPath.startsWith(`${BASE_PATH}/health`);

  if (isApiPath) return next();

  if (requestPath === "/" || requestPath.startsWith(BASE_PATH)) {
    return res.sendFile(indexPath);
  }

  return next();
});

if (!isProduction) {
  app.get("/boom", (_req, _res) => {
    throw new Error("BOOM test route");
  });
}

app.use(require("./middlewares/errorHandler"));

module.exports = app;