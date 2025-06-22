export const PAYMENT_CONFIG = {
  CURRENCIES: {
    USD: 'usd',
    EUR: 'eur',
    GBP: 'gbp',
    CAD: 'cad',
    AUD: 'aud'
  },

  SHIPPING_COUNTRIES: [
    'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE'
  ],

  PAYMENT_METHODS: ['card', 'ideal', 'sepa_debit'],

  WEBHOOK_EVENTS: [
    'checkout.session.completed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'invoice.payment_succeeded',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ],

  DEFAULT_METADATA: {
    orderSource: 'ecommerce_website',
    version: '1.0'
  },
  LIMITS: {
    MAX_ITEMS_PER_ORDER: 50,
    MIN_AMOUNT: 0.50, // $0.50 minimum
    MAX_AMOUNT: 99999.99 // $99,999.99 maximum
  },
  URLS: {
    SUCCESS: '/success',
    CANCEL: '/cart',
    RETURN: '/account/orders'
  }
};
export const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Invalid email format'
  },
  
  amount: {
    min: PAYMENT_CONFIG.LIMITS.MIN_AMOUNT,
    max: PAYMENT_CONFIG.LIMITS.MAX_AMOUNT,
    message: `Amount must be between $${PAYMENT_CONFIG.LIMITS.MIN_AMOUNT} and $${PAYMENT_CONFIG.LIMITS.MAX_AMOUNT}`
  },

  items: {
    maxCount: PAYMENT_CONFIG.LIMITS.MAX_ITEMS_PER_ORDER,
    requiredFields: ['name', 'price'],
    message: 'Invalid items format'
  }
};
export const ERROR_MESSAGES = {
  PAYMENT_FAILED: 'Payment processing failed. Please try again.',
  INVALID_AMOUNT: 'Invalid payment amount.',
  INVALID_ITEMS: 'Invalid or missing items.',
  SESSION_NOT_FOUND: 'Payment session not found.',
  WEBHOOK_VERIFICATION_FAILED: 'Webhook verification failed.',
  MISSING_REQUIRED_FIELDS: 'Missing required fields.',
  PAYMENT_ALREADY_PROCESSED: 'Payment has already been processed.'
};