function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    error: {
      status,
      message: err.message || "Internal server error",
    },
  });
}

module.exports = errorHandler;
