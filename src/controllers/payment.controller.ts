import Stripe from "stripe";
import { Request, Response } from "express";
import { stripe } from "../config/stripe";
import { findOrCreateStripeCustomer } from "../services/stripe.service";
import User from "../models/User";

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
    const customer = await findOrCreateStripeCustomer(userId);

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customer.id,
      line_items: [
        {
          price: proPriceId,
          quantity: 1,
        },
      ],

      success_url: frontendSuccessUrl,
      cancel_url: frontendCancelUrl,

      metadata: {
        mongoUserId: userId,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.status(200).json({ sessionId: session.id });
  } catch (error: any) {
    console.error("Error creating Stripe Checkout session:", error);
    res.status(500).json({
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

export const cancelSubscription = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "User not authenticated" });
    return;
  }

  try {
    const user = await User.findById(userId);
    if (!user || !user.stripeSubscriptionId) {
      res
        .status(404)
        .json({ message: "Active subscription not found for this user." });
      return;
    }

    //  Cancel immediately
    // const deletedSubscription = await stripe.subscriptions.del(user.stripeSubscriptionId);

    // Cancel at period end (Recommended for better UX)
    const updatedSubscription = await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    console.log(
      `Subscription ${user.stripeSubscriptionId} marked to cancel at period end.`
    );

    res
      .status(200)
      .json({
        message:
          "Subscription cancellation requested successfully. Access remains until period end.",
        status: updatedSubscription.status,
      });
  } catch (error: any) {
    console.error("Error canceling Stripe subscription:", error);
    res
      .status(500)
      .json({ message: "Failed to cancel subscription", error: error.message });
  }
};
