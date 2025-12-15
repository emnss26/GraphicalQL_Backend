const config = require('../config');

function errorHandler(err, req, res, next) {
  // Log unexpected errors for debugging
  console.error('❌ Unhandled error:', err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: config.env !== 'production' ? err.stack : undefined,
  });
}

module.exports = errorHandler;