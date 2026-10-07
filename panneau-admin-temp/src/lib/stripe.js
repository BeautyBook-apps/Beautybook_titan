import { loadStripe } from "@stripe/stripe-js";

export const STRIPE_PUBLISHABLE_KEY = 
  import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  "pk_test_51TFtM7GVJqnzDwxZH3EHUkKXbAE6JSldMylAe6RE143lcMMENTfpcmc9i4aTaMbLxFCEW6kDtLposnUe5u5SQRBH00NN0Awwjc";

let stripePromiseInstance = null;

export const getStripe = () => {
  if (!stripePromiseInstance) {
    stripePromiseInstance = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromiseInstance;
};

export const stripePromise = getStripe();
