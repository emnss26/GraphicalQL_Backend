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

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) {
    const origin = req.headers.origin || req.headers.referer;

    if (isProduction && origin && !origin.startsWith(config.frontendUrl)) {
      return res
        .status(403)
        .json({ success: false, message: "CSRF Protection: Origin not allowed" });
    }
  }
  next();
});

if (!isProduction) {
  app.use(morgan("dev"));
}

app.disable("etag");

const authRouter = require("./resources/routers/auth.router");
const aecRouter = require("./resources/routers/aec.router");
const accRouter = require("./resources/routers/acc.router");
const plansRouter = require("./resources/routers/plans.router");
const datamanagementRouter = require("./resources/routers/dm.router");

app.use(["/auth", "/ControlPlanos/auth"], authRouter);
app.use(["/aec", "/ControlPlanos/aec"], aecRouter);
app.use(["/acc", "/ControlPlanos/acc"], accRouter);
app.use(["/plans", "/ControlPlanos/plans"], plansRouter);
app.use(["/dm", "/ControlPlanos/dm"], datamanagementRouter);

app.get(["/health", "/ControlPlanos/health"], (_req, res) => {
  res.json({
    success: true,
    message: "Backend API is online 🚀 (Express 4)",
    env: config.env,
  });
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/ControlPlanos", express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (!isProduction) {
  app.get("/boom", (_req, _res) => {
    throw new Error("BOOM test route");
  });
}

app.use(require("./middlewares/errorHandler"));

module.exports = app;