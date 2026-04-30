// app.js

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');

const app = express();

//Third party middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use((req, res, next) => {
    req.timestamp = new Date().toISOString();
    next();
});

app.use((req, res, next) => {
    console.log(`[${req.timestamp}] ${req.method} ${req.path}`);
    next();
});

app.get('/', (req, res) => {
    res.json({ message: 'Hello with middleware!', at: req.timestamp });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});