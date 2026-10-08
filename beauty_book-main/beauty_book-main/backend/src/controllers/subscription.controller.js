import Stripe from 'stripe';

// Stripe Subscription Checkout
export const createSubscriptionCheckout = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { priceId, successUrl, cancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: 'priceId requis' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'link'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/success`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/cancel`,
      customer_email: user.email,
      metadata: {
        user_id: user.id,
        user_email: user.email,
      },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionCheckout error:', error);
    return res.status(500).json({ error: error.message });
  }
};
