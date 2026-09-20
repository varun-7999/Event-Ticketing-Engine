const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const { startSeatCleanupWorker } = require('./utils/seatWorker');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.error('[Startup] MongoDB connection failed:', error.message);
    console.error('[Startup] Check MONGO_URI, network access, and the database server status.');
    process.exitCode = 1;
    return;
  }

  const httpServer = http.createServer(app);
  startSeatCleanupWorker(30000);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('[Startup] Server failed to start:', error.message);
  process.exitCode = 1;
});


