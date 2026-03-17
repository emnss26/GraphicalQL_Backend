const config = require("../config");

function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = config.env === "production";

  if (isProduction) {
    console.error("API ERROR", {
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      code: err.code || "INTERNAL_ERROR",
      message: err.message,
    });
  } else {
    console.error("API ERROR");
    console.error("URL:", req.method, req.originalUrl);
    console.error("STATUS:", statusCode);
    console.error("CODE:", err.code);
    console.error("MESSAGE:", err.message);
    console.error("STACK:\n", err.stack);
  }

  if (res.headersSent) return next(err);

  const clientMessage = isProduction ? "Internal Server Error" : err.message;

  res.status(statusCode).json({
    success: false,
    message: clientMessage,
    data: null,
    error: !isProduction
      ? {
          code: err.code || null,
          name: err.name || null,
          detail: err.stack || String(err),
        }
      : { code: err.code || "INTERNAL_ERROR" },
  });
}

module.exports = errorHandler;
