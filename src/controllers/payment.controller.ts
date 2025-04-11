import Stripe from "stripe";
import { Request, Response } from "express";
import { stripe } from "../config/stripe";
import { findOrCreateStripeCustomer } from "../services/stripe.service";

export const createCheckoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id; // Get user ID from authenticateToken middleware
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const frontendSuccessUrl = `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const frontendCancelUrl = `${process.env.FRONTEND_URL}/payment/canceled`;

  if (!userId) {
    res.status(401).json({ message: "User not authenticated" });
    return;
  }
  if (!proPriceId) {
    console.error("STRIPE_PRO_PRICE_ID is not set.");
    res
      .status(500)
      .json({ message: "Server configuration error: Price ID missing" });
    return;
  }
  if (!frontendSuccessUrl || !frontendCancelUrl) {
    console.error("FRONTEND_URL is not set for redirects.");
    res
      .status(500)
      .json({ message: "Server configuration error: Redirect URLs missing" });
    return;
  }

  try {
    // 1. Get or create the Stripe Customer for this user
    const customer = await findOrCreateStripeCustomer(userId);

    // 2. Create a Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "subscription", // Important: for recurring payments
      customer: customer.id, // Associate with the Stripe Customer
      line_items: [
        {
          price: proPriceId, // The ID of the 'Pro' plan price
          quantity: 1,
        },
      ],
      // Redirect URLs after payment attempt
      success_url: frontendSuccessUrl,
      cancel_url: frontendCancelUrl,
      // Optional: Pre-fill email
      // customer_email: customer.email,
      // Optional: Collect billing address if needed
      // billing_address_collection: 'required',
      // Optional: Allow promo codes
      // allow_promotion_codes: true,
      // Optional: Pass metadata back to your webhook
      metadata: {
        mongoUserId: userId,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    // 3. Send the session ID back to the client
    res.status(200).json({ sessionId: session.id });
  } catch (error: any) {
    console.error("Error creating Stripe Checkout session:", error);
    res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

// Add cancel subscription controller later...
