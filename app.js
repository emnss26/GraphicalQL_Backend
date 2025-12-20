const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const app = express();

// --- Security Middleware ---

// Set HTTP headers for security.
// Disabling Cross-Origin-Resource-Policy to allow frontend communication on different ports.
app.use(helmet({ crossOriginResourcePolicy: false }));

// Rate limiting to prevent brute-force attacks.
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, 
    standardHeaders: true, 
    legacyHeaders: false, 
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// --- Server Configuration ---

// Trust headers from reverse proxy (IIS/Nginx).
app.set('trust proxy', 1);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS Configuration
app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
}));
app.options(/.*/, cors());

// Logger (enable only in non-production environments)
if (config.env !== 'production') {
    app.use(morgan('dev'));
}

// --- Routes ---

// Health Check
app.get('/', (req, res) => {
    res.json({ success: true, message: 'Backend API is online 🚀', env: config.env });
});

app.use('/auth', require('./resources/routers/auth.router'));
app.use('/aec', require('./resources/routers/aec.router'));
app.use('/acc', require('./resources/routers/acc.router'));
app.use('/plans', require('./resources/routers/plans.router'));

// --- Error Handling ---

app.use(require('./middlewares/errorHandler'));

module.exports = app;