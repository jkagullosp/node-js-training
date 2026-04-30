const express = require('express');
const app = express();

app.get('/slow', async (req, res, next) => {
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    throw new Error('Something went wrong');
    
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(`[ERROR CAUGHT] ${err.message}`);
  
  res.status(500).json({
    error: {
      status: 500,
      message: err.message
    }
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Async Errors API running at http://localhost:${PORT}`);
});