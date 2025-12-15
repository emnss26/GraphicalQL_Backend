const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config');

const app = express();

app.set('trust proxy', 1); // Trust reverse proxy headers

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.options(/.*/, cors());

if (config.env !== 'production') {
  app.use(morgan('dev'));
}

app.use('/auth', require('./resources/routers/auth.router'));
app.use('/aec', require('./resources/routers/aec.router'));
app.use('/acc', require('./resources/routers/acc.router'));
app.use('/plans', require('./resources/routers/plans.router'));

app.get('/', (req, res) => {
  res.json({ message: 'Backend API is alive 🚀' });
});

app.listen(config.port, () => {
  console.log(`🚀 Backend API running on port ${config.port} [${config.env}]`);
});

app.use(require('./middlewares/errorHandler'));

module.exports = app;