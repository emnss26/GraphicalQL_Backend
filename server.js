require("dotenv").config();

const http = require("http");
const app = require("./app");
const config = require("./config");

const port = normalizePort(config.port || "3000");
app.set("port", port);

const server = http.createServer(app);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return value; // named pipe
  if (parsed >= 0) return parsed; // port number
  return false;
}

function onError(err) {
  if (err.syscall !== "listen") throw err;

  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  switch (err.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw err;
  }
}

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  console.log(`🚀 Server running on ${bind} [${config.env}]`);
}
