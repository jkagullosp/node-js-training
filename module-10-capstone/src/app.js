const express = require("express");
const notesRouter = require("./routes/notes");
const errorHandler = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.use(express.json());
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  app.use("/notes", notesRouter);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
