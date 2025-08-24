require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

const { testConnection } = require("./database/index");
const Productroutes = require('./routes/productrotes.js');
const authroutes = require('./routes/authRoutes.js');
const cartRoutes = require('./routes/cartRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const { getshippedOrders, UpdateOrder } = require('./controller/ordertraking.js');
const { getproductfromcsv } = require('./controller/getproducts.js');
const { parseWebhookBody, rateLimitPayments } = require('./middleware/stripe.js');
const { initializeSocket } = require('./socket/socketServer');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(parseWebhookBody);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use('/api/auth', authroutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/product', Productroutes);

app.use('/api/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({
    status: "ok",
    message: "Server is Running",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  console.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);

  console.error(`Unhandled error [${errorId}] at ${req.method} ${req.url}:`, error);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    errorId,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

async function initializeDatabase() {
  try {
    await testConnection();
    console.log('Database connection established successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

initializeDatabase();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

server.on('error', (error) => {
  console.error('Server error occurred:', error);
});

module.exports = app;
