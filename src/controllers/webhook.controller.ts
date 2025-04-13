import { Request, Response } from "express";
import mongoose from "mongoose";
import logger from "../utils/logger";
import { saveLogToDb } from "../services/log.service";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import User, { IUser, UserRole, SubscriptionStatus } from "../models/User";

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // console.error("STRIPE_WEBHOOK_SECRET is not set.");
    logger.error(
      "Webhook configuration error: STRIPE_WEBHOOK_SECRET is not set."
    );
    saveLogToDb({
      level: "error",
      message: "Webhook Error: Server configuration missing webhook secret.",
      ipAddress: req.ip, // Include IP if relevant
    });
    res
      .status(400)
      .send("Webhook Error: Server configuration missing webhook secret.");
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;

  try {
    const bodyBuffer = req.body;

    event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
  } catch (err: any) {
    // console.error(`Webhook signature verification failed: ${err.message}`);
    logger.error(
      { err, ip: req.ip },
      `Webhook signature verification failed: ${err.message}`
    );
    // Save signature verification failure to DB log
    saveLogToDb({
      level: "error",
      message: `Webhook signature verification failed: ${err.message}`,
      error: err,
      ipAddress: req.ip,
      meta: { signatureHeader: sig }, // Add relevant metadata
    });
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // console.log(` Stripe Webhook Received: ${event.type}`);
  logger.info(
    { eventType: event.type, eventId: event.id },
    `Stripe Webhook Received`
  );
  const dataObject = event.data.object as any;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = dataObject as Stripe.Checkout.Session;
        logger.debug(
          { eventId: event.id, sessionId: session.id },
          `Processing ${event.type}`
        );

        if (
          session.mode === "subscription" &&
          session.payment_status === "paid"
        ) {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const mongoUserId = session.metadata?.mongoUserId; // Get our user ID

          // console.log(
          //   `Checkout session completed for subscription ${subscriptionId}, customer ${customerId}, user ${mongoUserId}`
          // );
          logger.info(
            {
              eventId: event.id,
              subId: subscriptionId,
              custId: customerId,
              userId: mongoUserId,
            },
            `Checkout session completed for subscription`
          );
          if (!mongoUserId) {
            // console.error(
            //   "Webhook Error: mongoUserId missing in checkout session metadata."
            // );
            logger.error(
              {
                eventId: event.id,
                sessionId: session.id,
                metadata: session.metadata,
              },
              "Webhook Error: mongoUserId missing in checkout session metadata."
            );
            // Save error log to DB
            saveLogToDb({
              level: "error",
              message:
                "Webhook Error: mongoUserId missing in checkout session metadata.",
              meta: {
                eventId: event.id,
                sessionId: session.id,
                customerId: customerId,
              },
            });
            break;
          }

          await User.findByIdAndUpdate(mongoUserId, {
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            stripeSubscriptionStatus: "pro",
            role: "pro",
          });
          console.log(`User ${mongoUserId} updated to PRO`);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = dataObject as Stripe.Invoice & {
          subscription?: string;
        };
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        console.log(
          `Invoice payment succeeded for subscription ${subscriptionId}, customer ${customerId}`
        );

        const user = await User.findOne({
          $or: [
            { stripeSubscriptionId: subscriptionId },
            { stripeCustomerId: customerId },
          ],
        });
        if (user) {
          if (user.stripeSubscriptionStatus !== "pro" || user.role !== "pro") {
            user.stripeSubscriptionStatus = "pro";
            user.role = "pro";
            await user.save();
            console.log(`User ${user._id} status confirmed as PRO`);
          }
        } else {
          console.error(
            `Webhook Error: User not found for successful invoice payment. Sub: ${subscriptionId}, Cust: ${customerId}`
          );
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = dataObject as Stripe.Invoice & {
          subscription?: string;
        };
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer as string;
        console.log(
          `Invoice payment failed for subscription ${subscriptionId}, customer ${customerId}`
        );

        const user = await User.findOne({
          $or: [
            { stripeSubscriptionId: subscriptionId },
            { stripeCustomerId: customerId },
          ],
        });
        if (user) {
          user.stripeSubscriptionStatus = "past_due";

          await user.save();
          console.log(`User ${user._id} subscription marked as past_due`);
        } else {
          console.error(
            `Webhook Error: User not found for failed invoice payment. Sub: ${subscriptionId}, Cust: ${customerId}`
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = dataObject as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const newStatus = subscription.status;
        const mongoUserId = subscription.metadata?.mongoUserId;

        console.log(
          `Subscription ${subscription.id} updated for customer ${customerId}. New status: ${newStatus}`
        );

        let user = mongoUserId ? await User.findById(mongoUserId) : null;
        if (!user) {
          user = await User.findOne({ stripeCustomerId: customerId });
        }

        if (user) {
          let internalStatus: SubscriptionStatus = "free";
          let userRole: UserRole = "free";

          if (newStatus === "active") {
            internalStatus = "pro";
            userRole = "pro";
          } else if (newStatus === "past_due" || newStatus === "unpaid") {
            internalStatus = "past_due";
            userRole = "free";
          } else if (newStatus === "canceled") {
            internalStatus = "canceled";
            userRole = "free";
          } else if (
            newStatus === "incomplete" ||
            newStatus === "incomplete_expired"
          ) {
            internalStatus = "incomplete";
            userRole = "free";
          }

          user.stripeSubscriptionStatus = internalStatus;
          user.role = userRole;
          user.stripeSubscriptionId = subscription.id;
          if (newStatus === "canceled") {
          }

          await user.save();
          console.log(
            `User ${user._id} subscription status updated to ${internalStatus}, role ${userRole}`
          );
        } else {
          console.error(
            `Webhook Error: User not found for subscription update. Sub: ${subscription.id}, Cust: ${customerId}`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = dataObject as Stripe.Subscription;
        const customerId = subscription.customer as string;
        console.log(
          `Subscription ${subscription.id} deleted for customer ${customerId}`
        );

        const user = await User.findOne({ stripeCustomerId: customerId });
        if (user) {
          user.stripeSubscriptionId = undefined;
          user.stripeSubscriptionStatus = "canceled";
          user.role = "free";
          await user.save();
          console.log(
            `User ${user._id} subscription deleted, role set to free.`
          );
        } else {
          console.error(
            `Webhook Error: User not found for subscription deletion. Sub: ${subscription.id}, Cust: ${customerId}`
          );
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (dbOrProcessingError: any) {
    // console.error(
    //   `Error processing webhook event ${event.id} (${event.type}):`,
    //   dbOrProcessingError
    // );
    logger.error(
      { err: dbOrProcessingError, eventId: event.id, eventType: event.type },
      `Error processing webhook event`
    );
    saveLogToDb({
      level: "error",
      message: `Unexpected error processing webhook: ${dbOrProcessingError.message}`,
      error: dbOrProcessingError,
      meta: { eventId: event.id, eventType: event.type },
    });
  }

  res.status(200).json({ received: true });
};
