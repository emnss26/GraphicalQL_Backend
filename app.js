const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("./config");

const app = express();

const isProduction = config.env === "production";

app.set("trust proxy", 1);

app.use(
  helmet({
    // Allows the frontend to load resources when running on different ports/origins.
    crossOriginResourcePolicy: false,
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

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.options(/.*/, cors());

if (!isProduction) {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Backend API is online 🚀",
    env: config.env,
  });
});

app.use("/auth", require("./resources/routers/auth.router"));
app.use("/aec", require("./resources/routers/aec.router"));
app.use("/acc", require("./resources/routers/acc.router"));
app.use("/plans", require("./resources/routers/plans.router"));

app.use(require("./middlewares/errorHandler"));

module.exports = app;
