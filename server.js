const http = require("http");
const app = require("./app");
const config = require("./config");
const knex = require("./utils/db/knex");

const port = normalizePort(process.env.PORT || config.port || "3000");
app.set("port", port);

const TIMEOUT_MS = 15 * 60 * 1000;

function normalizePort(value) {
  const parsed = parseInt(value, 10);

  if (Number.isNaN(parsed)) {
   
    return value;
  }

  if (parsed >= 0) {
    
    return parsed;
  }

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
  console.log(`🚀 Server running on ${bind} [${config.env || 'development'}]`);
}

const server = http.createServer(app);

server.timeout = TIMEOUT_MS;
server.keepAliveTimeout = TIMEOUT_MS;
server.headersTimeout = TIMEOUT_MS + 1000;
server.requestTimeout = TIMEOUT_MS;
server.on("error", onError);
server.on("listening", onListening);

async function startServer() {
  try {
    await knex.verifyConnection();
    server.listen(port);
  } catch (err) {
    console.error("❌ Startup aborted:", err.message);
    process.exit(1);
  }
}

startServer();
