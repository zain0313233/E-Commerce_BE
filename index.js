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
const portalRoutes = require('./routes/portalRoutes.js');
const chatRoutes = require('./routes/chatRoutes.js');
const supportRoutes = require('./routes/supportRoutes.js');
const { getshippedOrders, UpdateOrder } = require('./controller/ordertraking.js');
const { getproductfromcsv } = require('./controller/getproducts.js');
const { handleWebhook } = require('./controller/paymentController');
const { parseWebhookBody } = require('./middleware/stripe.js');
const { initializeSocket } = require('./socket/socketServer');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);

const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: corsOrigins,
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

app.post(
  '/api/order/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body;
    next();
  },
  (req, res, next) => {
    req.io = io;
    next();
  },
  handleWebhook
);

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
app.use('/api/portal', portalRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/support', supportRoutes);
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
    console.error(
      'Database connection test failed - API calls that need Postgres will error until this is fixed:',
      error
    );
    console.error(
      'Hint: Check Neon project is active, DATABASE_URL in .env, and remove channel_binding=require if present'
    );
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
