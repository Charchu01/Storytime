import { loadStripe } from '@stripe/stripe-js';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const stripePromise = stripeKey ? loadStripe(stripeKey) : Promise.resolve(null);
