require("dotenv").config();
const app = require("./app");
const getDb = require("./config/db");
const { expireStale } = require("./services/orderService");
getDb().then(() => {
  setInterval(() => expireStale().catch(console.error), 60000); // releases expired reservations
  app.listen(process.env.PORT || 4000, () => console.log("API on :" + (process.env.PORT || 4000)));
});
