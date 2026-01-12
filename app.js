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
    origin: isProduction ? true : config.frontendUrl,
    credentials: true,
  })
);
app.options(/.*/, cors());

app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin || req.headers.referer;
    
   if (isProduction && origin && !origin.startsWith(config.frontendUrl)) {
       console.warn(`CSRF Blocked: Origin ${origin} does not match ${config.frontendUrl}`);
       return res.status(403).json({ success: false, message: "CSRF Protection: Origin not allowed" });
    }
  }
  next();
});

if (!isProduction) {
  app.use(morgan("dev"));
}

app.use("/auth", require("./resources/routers/auth.router"));
app.use("/aec", require("./resources/routers/aec.router"));
app.use("/acc", require("./resources/routers/acc.router"));
app.use("/plans", require("./resources/routers/plans.router"));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Backend API is online 🚀",
    env: config.env,
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(require("./middlewares/errorHandler"));

module.exports = app;