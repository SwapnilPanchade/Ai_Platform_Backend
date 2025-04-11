import Stripe from "stripe";
import { stripe } from "../config/stripe";
import User, { IUser } from "../models/User"; // Import User model

/**
 * Finds or creates a Stripe Customer associated with a User.
 * Saves the Stripe Customer ID to the User document if created.
 * @param userId - The MongoDB ObjectId of the user.
 * @returns The Stripe Customer object.
 * @throws Error if user not found or Stripe API fails.
 */
export const findOrCreateStripeCustomer = async (
  userId: string
): Promise<Stripe.Customer> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User not found with ID: ${userId}`);
  }

  // 1. Check if user already has a Stripe Customer ID
  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      // Check if customer wasn't deleted in Stripe
      if (!customer.deleted) {
        return customer as Stripe.Customer;
      }
      // If deleted, fall through to create a new one
      console.warn(
        `Stripe customer ${user.stripeCustomerId} was deleted. Creating a new one.`
      );
    } catch (error: any) {
      // Handle cases where retrieve fails (e.g., ID is invalid)
      console.error(
        `Failed to retrieve Stripe customer ${user.stripeCustomerId}:`,
        error.message
      );
      // Fall through to create a new one
    }
  }

  // 2. Create a new Stripe Customer
  console.log(`Creating new Stripe customer for user ${user.email}`);
  const customerParams: Stripe.CustomerCreateParams = {
    email: user.email,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(), // Optional: add name
    metadata: {
      mongoUserId: (user._id as any).toString(), // Link back to your user ID
    },
  };

  const newCustomer = await stripe.customers.create(customerParams);

  // 3. Save the new Stripe Customer ID to the User document
  user.stripeCustomerId = newCustomer.id;
  try {
    await user.save();
  } catch (dbError) {
    console.error(
      `Failed to save Stripe Customer ID ${newCustomer.id} to user ${user._id}:`,
      dbError
    );
    // Decide how to handle this - maybe delete the Stripe customer? Or retry?
    // For now, we'll proceed but log the error. The ID might be orphaned.
  }

  return newCustomer;
};
