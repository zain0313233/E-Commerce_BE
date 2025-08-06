require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { createServer } = require('http');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }
  } : undefined,
  base: {
    service: 'ecommerce-api',
    environment: process.env.NODE_ENV || 'development'
  }
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent'
    }
    return 'info'
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
});

const { testConnection } = require("./database/index");
const Productroutes = require('./routes/productrotes');
const authroutes = require('./routes/authroutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const { getshippedOrders, UpdateOrder } = require('./controller/ordertraking.js');
const { getproductfromcsv } = require('./controller/getproducts.js');
const { parseWebhookBody, rateLimitPayments } = require('./middleware/stripe.js');
const { initializeSocket } = require('./socket/socketServer');

const app = express();
const server = createServer(app);
const io = initializeSocket(server);

app.use(httpLogger);

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
    req.log.warn({ ip: req.ip }, 'Rate limit exceeded');
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
  req.logger = logger;
  req.io = io;
  next();
});

app.use('/api/auth', authroutes);
app.use('/api/cart', cartRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/product', Productroutes);

app.use('/api/health', (req, res) => {
  req.log.info('Health check requested');
  res.status(200).json({
    status: "ok",
    message: "Server is Running",
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  req.log.warn({ path: req.path, method: req.method }, 'Route not found');
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  req.log.error({ 
    err: error, 
    errorId,
    stack: error.stack,
    url: req.url,
    method: req.method
  }, 'Unhandled error occurred');
  
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
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to database');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

initializeDatabase();

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started successfully');
});

server.on('error', (error) => {
  logger.error({ err: error }, 'Server error occurred');
});

module.exports = app;