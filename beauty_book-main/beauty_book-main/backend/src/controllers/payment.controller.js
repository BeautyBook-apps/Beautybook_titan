import Stripe from 'stripe';
import { supabaseAdmin } from '../config/supabase.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getOrCreateStripeCustomer(email, userId) {
  // Check if user already has a stripe_customer_id in profiles
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  });

  // Save stripe_customer_id to profiles
  await supabaseAdmin
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer.id;
}

// POST /api/payments/setup-intent
export const createSetupIntent = async (req, res) => {
  try {
    const customerId = await getOrCreateStripeCustomer(req.user.email, req.user.id);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return res.json({ clientSecret: setupIntent.client_secret, customerId });
  } catch (error) {
    console.error('[SetupIntent Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// GET /api/payments/payment-methods
export const getPaymentMethods = async (req, res) => {
  try {
    const customerId = await getOrCreateStripeCustomer(req.user.email, req.user.id);

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    const cards = paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      cardholder_name: pm.billing_details?.name || '',
      is_default: pm.metadata?.is_default === 'true',
    }));

    return res.json({ cards });
  } catch (error) {
    console.error('[GetPaymentMethods Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// DELETE /api/payments/payment-methods/:id
export const deletePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    await stripe.paymentMethods.detach(id);
    return res.json({ success: true });
  } catch (error) {
    console.error('[DeletePaymentMethod Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/payments/payment-methods/:id/default
export const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = await getOrCreateStripeCustomer(req.user.email, req.user.id);

    // Update all payment methods metadata
    const existing = await stripe.paymentMethods.list({ customer: customerId, type: 'card' });
    for (const pm of existing.data) {
      await stripe.paymentMethods.update(pm.id, {
        metadata: { is_default: pm.id === id ? 'true' : 'false' },
      });
    }

    // Set as default on customer
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[SetDefaultPaymentMethod Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/payments/charge-saved
export const chargeSavedCard = async (req, res) => {
  try {
    const { payment_method_id, amount, currency, description, metadata } = req.body;

    if (!payment_method_id || !amount) {
      return res.status(400).json({ error: 'payment_method_id et amount requis' });
    }

    const customerId = await getOrCreateStripeCustomer(req.user.email, req.user.id);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency || 'eur',
      customer: customerId,
      payment_method: payment_method_id,
      description: description || 'Paiement BeautyBook',
      confirm: true,
      off_session: true,
      metadata: metadata || {},
    });

    return res.json({ success: true, paymentIntentId: paymentIntent.id });
  } catch (error) {
    console.error('[ChargeSavedCard Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/payments/checkout-session
export const createCheckoutSession = async (req, res) => {
  try {
    const { items, type } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Aucun article à payer' });
    }

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name || item.service_name || 'Produit',
          description: item.description || undefined,
          images: item.image_url ? [item.image_url] : undefined,
        },
        unit_amount: Math.round((item.price || item.service_price || 0) * 100),
      },
      quantity: item.quantity || 1,
    }));

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
    const isReservation = type === 'reservation';
    const successUrl = isReservation
      ? `${origin}/rendez-vous?payment=success&crg_code=${req.body.metadata?.crg_code || ''}`
      : `${origin}/panier?success=true`;
    const cancelUrl = isReservation
      ? `${origin}/reservation?payment=cancelled`
      : `${origin}/panier`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'],
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: type || 'panier',
        reservation_id: req.body.metadata?.reservation_id || '',
        payment_type: req.body.metadata?.payment_type || 'full',
        crg_code: req.body.metadata?.crg_code || '',
      },
    });

    return res.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    console.error('[Stripe Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/payments/wallet-recharge
export const createWalletRecharge = async (req, res) => {
  try {
    const { amount, returnPath } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    if (amount < 1) {
      return res.status(400).json({ error: 'Montant minimum: 1€' });
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
    const successPath = returnPath || '/mon-solde';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Rechargement Beauty Wallet',
            description: `Ajout de ${amount.toFixed(2)}€ à votre portefeuille`,
          },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        type: 'wallet_recharge',
        user_email: req.user.email,
        amount: amount.toString(),
      },
      success_url: `${origin}${successPath}?payment=success`,
      cancel_url: `${origin}${successPath}?payment=cancelled`,
    });

    return res.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    console.error('[Wallet Recharge Error]', error.message);
    return res.status(500).json({ error: error.message });
  }
};

// POST /api/payments/webhook
export const stripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[Webhook] Signature invalide:', err.message);
    return res.status(400).send('Webhook Error');
  }

  console.log('[Webhook] Event reçu:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const metadata = session.metadata || {};

    // ─── Wallet Recharge ───────────────────────────
    if (metadata.type === 'wallet_recharge') {
      const userEmail = metadata.user_email;
      const amount = parseFloat(metadata.amount);

      if (userEmail && amount > 0) {
        try {
          // Find existing SoldeBeautyPay record
          const { data: existing } = await supabaseAdmin
            .from('SoldeBeautyPay')
            .select('*')
            .eq('user_email', userEmail)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const newTx = {
            id: `tx_${Date.now()}`,
            label: 'Rechargement Beauty Wallet',
            date: new Date().toISOString(),
            amount: amount,
            type: 'credit',
            category: 'recharge',
            stripe_session_id: session.id,
          };

          if (existing) {
            await supabaseAdmin.from('SoldeBeautyPay').update({
              solde: (existing.solde || 0) + amount,
              transactions: [newTx, ...(existing.transactions || [])],
            }).eq('id', existing.id);
          } else {
            await supabaseAdmin.from('SoldeBeautyPay').insert({
              user_email: userEmail,
              solde: amount,
              transactions: [newTx],
            });
          }

          console.log(`[Webhook] ✅ Wallet recharge: ${amount}€ pour ${userEmail}`);

          // Notification
          await supabaseAdmin.from('Notification').insert({
            user_email: userEmail,
            type: 'wallet',
            title: '💰 Portefeuille rechargé !',
            body: `${amount.toFixed(2)}€ ont été ajoutés à votre Beauty Wallet.`,
            link: '/mon-solde',
            read: false,
          });
        } catch (err) {
          console.error('[Webhook] Erreur wallet recharge:', err.message);
        }
      }
    }

    // ─── Reservation Payment ───────────────────────
    const reservationId = metadata.reservation_id;
    const paymentType = metadata.payment_type || 'full';

    if (reservationId) {
      try {
        const newPaymentStatus = paymentType === 'acompte' ? 'acompte_paye' : 'paye';

        await supabaseAdmin.from('Reservation').update({
          status: 'confirme',
          payment_status: newPaymentStatus,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent || null,
        }).eq('id', reservationId);

        console.log(`[Webhook] ✅ Réservation ${reservationId} mise à jour`);

        // Fetch reservation for notifications
        const { data: resa } = await supabaseAdmin
          .from('Reservation').select('*').eq('id', reservationId).single();

        if (resa) {
          await supabaseAdmin.from('Notification').insert([
            {
              user_email: resa.client_email, type: 'reservation',
              title: '💳 Paiement confirmé !',
              body: `Votre paiement pour "${resa.service_name}" a bien été reçu. RDV le ${resa.date} à ${resa.time_slot}. 🎉`,
              link: '/rendez-vous', read: false,
            },
            {
              user_email: resa.pro_email, type: 'reservation',
              title: '💰 Paiement reçu',
              body: `${resa.client_email} a payé pour "${resa.service_name}" le ${resa.date} à ${resa.time_slot}.`,
              link: '/pro/gestion-agenda', read: false,
            }
          ]);
        }
      } catch (err) {
        console.error('[Webhook] Erreur mise à jour réservation:', err.message);
      }
    }
  }

  return res.json({ received: true });
};

// POST /api/payments/subscription-checkout
export const createSubscriptionCheckout = async (req, res) => {
  try {
    const { plan, email } = req.body;
    if (!plan || !email) return res.status(400).json({ error: 'Plan et email requis' });

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price: plan, // Stripe price ID
        quantity: 1,
      }],
      success_url: `${origin}/pro/abonnements?success=true`,
      cancel_url: `${origin}/pro/abonnements?cancelled=true`,
    });

    return res.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
