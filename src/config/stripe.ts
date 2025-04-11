// src/config/stripe.ts
import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.error(
    "!!! STRIPE_SECRET_KEY is not defined in environment variables !!!"
  );
  throw new Error("Stripe secret key is not configured.");
}

export const stripe = new Stripe(secretKey, {
  apiVersion: "2025-03-31.basil", // Use the latest API version
  typescript: true, // Enable TypeScript support
});
