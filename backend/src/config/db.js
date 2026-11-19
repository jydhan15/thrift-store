require("dns").setServers(["8.8.8.8", "1.1.1.1"]);
const mongoose = require("mongoose");
let connection = null; // Singleton: one shared connection
module.exports = async function getDb() {
  if (!connection) connection = await mongoose.connect(process.env.MONGO_URI);
  return connection;
};
