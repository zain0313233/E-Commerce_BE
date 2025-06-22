import express from 'express';
import { 
  createPaymentIntent, 
  getPaymentIntent,
  createCheckoutSession,
  getSession,
  handleWebhook 
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntent);
router.get('/payment-intent/:id', getPaymentIntent);
router.post('/create-checkout-session', createCheckoutSession);
router.get('/session/:session_id', getSession);
router.post('/webhook', handleWebhook);

export default router;