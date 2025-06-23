
const Stripe =require('stripe');
const { VALIDATION_RULES, ERROR_MESSAGES } = require('../config/paymentConfig');


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16', 
});




 const validatePaymentIntent = (req, res, next) => {
  const { amount, currency = 'usd' } = req.body;

  const errors = [];

  if (!amount || typeof amount !== 'number') {
    errors.push('Amount is required and must be a number');
  } else if (amount < VALIDATION_RULES.amount.min || amount > VALIDATION_RULES.amount.max) {
    errors.push(VALIDATION_RULES.amount.message);
  }

 
  if (!['usd', 'eur', 'gbp', 'cad', 'aud'].includes(currency)) {
    errors.push('Unsupported currency');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};


 const validateCheckoutSession = (req, res, next) => {
  const { items, customerEmail } = req.body;

  const errors = [];

 
  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('Items array is required and cannot be empty');
  } else {
  
    items.forEach((item, index) => {
      if (!item.name || typeof item.name !== 'string') {
        errors.push(`Item ${index + 1}: Name is required and must be a string`);
      }
      
      if (!item.price || typeof item.price !== 'number' || item.price <= 0) {
        errors.push(`Item ${index + 1}: Valid price is required`);
      }

      if (item.quantity && (typeof item.quantity !== 'number' || item.quantity <= 0)) {
        errors.push(`Item ${index + 1}: Quantity must be a positive number`);
      }
    });

 
    if (items.length > VALIDATION_RULES.items.maxCount) {
      errors.push(`Maximum ${VALIDATION_RULES.items.maxCount} items allowed per order`);
    }
  }


  if (customerEmail && !VALIDATION_RULES.email.pattern.test(customerEmail)) {
    errors.push(VALIDATION_RULES.email.message);
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};


 const parseWebhookBody = (req, res, next) => {
  if (req.path === '/webhook') {
   
    req.body = req.rawBody;
  }
  next();
};


 const dollarsToCents = (dollars) => {
  return Math.round(dollars * 100);
};


 const centsToDollars = (cents) => {
  return cents / 100;
};


 const formatAmount = (amount, currency = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(centsToDollars(amount));
};

 const generateOrderId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `order_${timestamp}_${randomStr}`;
};


const validateWebhookSignature = (payload, signature, secret) => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
};


 const handleStripeError = (error, res) => {
  console.error('Stripe error:', error);

  switch (error.type) {
    case 'StripeCardError':
      return res.status(400).json({
        error: 'Your card was declined.',
        code: error.code
      });

    case 'StripeRateLimitError':
      return res.status(429).json({
        error: 'Too many requests made to the API too quickly.'
      });

    case 'StripeInvalidRequestError':
      return res.status(400).json({
        error: 'Invalid parameters were supplied to Stripe API.'
      });

    case 'StripeAPIError':
      return res.status(500).json({
        error: 'An error occurred with our payment system.'
      });

    case 'StripeConnectionError':
      return res.status(500).json({
        error: 'Network communication with Stripe failed.'
      });

    case 'StripeAuthenticationError':
      return res.status(500).json({
        error: 'Authentication with Stripe API failed.'
      });

    default:
      return res.status(500).json({
        error: 'An unexpected error occurred.'
      });
  }
};


const rateLimitStore = new Map();

 const rateLimitPayments = (windowMs = 15 * 60 * 1000, maxRequests = 10) => {
  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;


    for (const [key, timestamps] of rateLimitStore.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      if (validTimestamps.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, validTimestamps);
      }
    }

  
    const userRequests = rateLimitStore.get(identifier) || [];
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: 'Too many payment requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

   
    recentRequests.push(now);
    rateLimitStore.set(identifier, recentRequests);

    next();
  };
};

module.exports = {
  validatePaymentIntent,
  validateCheckoutSession,
  parseWebhookBody,
  dollarsToCents,
  centsToDollars,
  formatAmount,
  generateOrderId,
  validateWebhookSignature,
  handleStripeError,
  rateLimitPayments
};