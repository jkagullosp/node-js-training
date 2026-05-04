// comment-api.js
const express = require('express');

function createCommentApp() {
  const app = express();
  app.use(express.json());

  // TODO: Implement endpoints

  return app;
}

module.exports = createCommentApp;
