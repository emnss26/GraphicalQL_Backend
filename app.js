const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const morgan = require("morgan");

dotenv.config();
const app = express();

app.use(express.json()); 

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.options(/.*/, cors());
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/auth", require('./resources/routers/auth.router'));
app.use("/aec", require('./resources/routers/aec.router'));
app.use("/acc", require('./resources/routers/acc.router'));
app.use("/plans", require('./resources/routers/plans.router'))


app.get("/", (req, res) => {
  res.json({ message: "Backend API is alive 🚀" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API is alive and running on port ${PORT}`);
});

module.exports = app;