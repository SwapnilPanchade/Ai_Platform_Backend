import { Router } from "express";
import { createCheckoutSession } from "../controllers/payment.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// POST /api/payments/create-checkout-session - User initiates subscription
router.post(
  "/create-checkout-session",
  authenticateToken,
  createCheckoutSession
);

// POST /api/payments/cancel-subscription - User cancels
// router.post("/cancel-subscription", authenticateToken, cancelSubscription);

// GET /api/payments/portal - Redirect to Stripe Billing Portal
// router.get('/portal', authenticateToken, createBillingPortalSession);

export default router;
