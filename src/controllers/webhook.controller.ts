import { Request, Response } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import User, { UserRole, SubscriptionStatus } from "../models/User";

export const handleStripeWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set.");
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
    console.error(`Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(` Stripe Webhook Received: ${event.type}`);
  const dataObject = event.data.object as any;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = dataObject as Stripe.Checkout.Session;
        if (
          session.mode === "subscription" &&
          session.payment_status === "paid"
        ) {
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;
          const mongoUserId = session.metadata?.mongoUserId; // Get our user ID

          console.log(
            `Checkout session completed for subscription ${subscriptionId}, customer ${customerId}, user ${mongoUserId}`
          );

          if (!mongoUserId) {
            console.error(
              "Webhook Error: mongoUserId missing in checkout session metadata."
            );
            break; // Don't proceed without user ID
          }

          // Update user record
          await User.findByIdAndUpdate(mongoUserId, {
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId, // Ensure customer ID is saved if somehow missed before
            stripeSubscriptionStatus: "pro",
            role: "pro", // Update role based on successful subscription
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

        // Find user by customer or subscription ID
        const user = await User.findOne({
          $or: [
            { stripeSubscriptionId: subscriptionId },
            { stripeCustomerId: customerId },
          ],
        });
        if (user) {
          // Ensure user status is 'pro'
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

        // Find user
        const user = await User.findOne({
          $or: [
            { stripeSubscriptionId: subscriptionId },
            { stripeCustomerId: customerId },
          ],
        });
        if (user) {
          // Mark as past due or update status based on subscription object if needed
          // Stripe might automatically retry, then eventually cancel.
          // Let customer.subscription.updated/deleted handle final status.
          user.stripeSubscriptionStatus = "past_due"; // Example status
          // Optionally change role here or wait for cancellation
          await user.save();
          console.log(`User ${user._id} subscription marked as past_due`);
          // TODO: Trigger email notification to user about failed payment
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
        const newStatus = subscription.status; // e.g., 'active', 'past_due', 'canceled'
        const mongoUserId = subscription.metadata?.mongoUserId; // Check if metadata exists here too

        console.log(
          `Subscription ${subscription.id} updated for customer ${customerId}. New status: ${newStatus}`
        );

        let user = mongoUserId ? await User.findById(mongoUserId) : null;
        if (!user) {
          user = await User.findOne({ stripeCustomerId: customerId });
        }

        if (user) {
          // Map Stripe status to your internal status
          let internalStatus: SubscriptionStatus = "free"; // Default if unrecognized
          let userRole: UserRole = "free";

          if (newStatus === "active") {
            internalStatus = "pro";
            userRole = "pro";
          } else if (newStatus === "past_due" || newStatus === "unpaid") {
            internalStatus = "past_due";
            userRole = "free"; // Or keep pro temporarily? Depends on grace period.
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
          // Add other Stripe statuses as needed ('trialing', etc.)

          user.stripeSubscriptionStatus = internalStatus;
          user.role = userRole; // Update role based on status
          user.stripeSubscriptionId = subscription.id; // Ensure ID is up-to-date
          if (newStatus === "canceled") {
            // Optionally clear the subscription ID if fully canceled
            // user.stripeSubscriptionId = undefined;
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
        // Occurs when a subscription is definitively canceled
        const subscription = dataObject as Stripe.Subscription;
        const customerId = subscription.customer as string;
        console.log(
          `Subscription ${subscription.id} deleted for customer ${customerId}`
        );

        const user = await User.findOne({ stripeCustomerId: customerId });
        if (user) {
          user.stripeSubscriptionId = undefined; // Clear the subscription ID
          user.stripeSubscriptionStatus = "canceled"; // Mark as canceled
          user.role = "free"; // Downgrade role
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

      // ... handle other event types if needed

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (dbOrProcessingError) {
    console.error(
      `Error processing webhook event ${event.id} (${event.type}):`,
      dbOrProcessingError
    );
    // Don't send 500 to Stripe here, as it will retry. Log it for investigation.
  }

  // Return a 200 response to acknowledge receipt of the event
  res.status(200).json({ received: true });
};
