const config = require('../config');


function errorHandler(err, req, res, next) {
const statusCode = err.status || 500;
const response = {
success: false,
message: err.message || 'Internal Server Error',
};


if (config.env !== 'production') {
response.error = err.stack;
}


console.error(`❌ Error [${statusCode}]:`, err.stack);
res.status(statusCode).json(response);
}


module.exports = errorHandler;