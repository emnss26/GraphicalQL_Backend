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

const authRouter = require("./resources/routers/auth.router");
const aecRouter = require("./resources/routers/aec.router");
const accRouter = require("./resources/routers/acc.router");
const plansRouter = require("./resources/routers/plans.router");

app.use(["/auth", "/ControlPlanos/auth"], authRouter);
app.use(["/aec", "/ControlPlanos/aec"], aecRouter);
app.use(["/acc", "/ControlPlanos/acc"], accRouter);
app.use(["/plans", "/ControlPlanos/plans"], plansRouter);

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Backend API is online 🚀",
    env: config.env,
  });
});


app.use(express.static(path.join(__dirname, "public")));
app.use("/ControlPlanos", express.static(path.join(__dirname, "public")));


app.get(["/ControlPlanos/*", "/ControlPlanos"], (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get(/.*$/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(require("./middlewares/errorHandler"));

module.exports = app;