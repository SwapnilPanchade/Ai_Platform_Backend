// src/routes/webhook.routes.ts
import { Router } from "express";
import { handleStripeWebhook } from "../controllers/webhook.controller";
import express from "express"; // Import express to use raw middleware

const router = Router();

// POST /webhooks/stripe - Listens for events from Stripe
// IMPORTANT: Use express.raw() middleware *only* for this route
// Place this route definition BEFORE server.ts applies express.json() globally if possible,
// OR ensure global express.json() doesn't interfere. Easiest is specific middleware here.
router.post(
  "/stripe",
  express.raw({ type: "application/json" }), // Use raw body parser for signature verification
  handleStripeWebhook
);

export default router;
