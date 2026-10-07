import React, { useState, useEffect } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
  PaymentRequestButtonElement,
} from "@stripe/react-stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { stripePromise, STRIPE_CARD_STYLE } from "@/lib/stripe";
import {
  Lock,
  ShieldCheck,
  CreditCard,
  Loader2,
} from "lucide-react";

/* ─────────────────────────── PAYPAL ID (sandbox) ──────────────────────────
   Remplace par ton Client ID PayPal réel (sandbox ou live).
   Dashboard: https://developer.paypal.com/developer/applications
   ──────────────────────────────────────────────────────────────────────────*/
const PAYPAL_CLIENT_ID =
  import.meta.env.VITE_PAYPAL_CLIENT_ID ||
  "AXr8HgMRY_q7QnZxFQTHoq3Jrk9WKmrXqD_test_placeholder";

/* ══════════════════════════════════════════════════════════════════════════
   Inner form — must be inside <Elements>
   ══════════════════════════════════════════════════════════════════════════*/
function StripeCardFormInner({
  amount,
  buttonLabel,
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  currency = "EUR",
  onSuccess,
  onError,
  isProcessing = false,
  showSubmitButton = true,
  onCardChange = null,
}) {
  const stripe = useStripe();
  const elements = useElements();

  // ── State ──
  const [activeTab, setActiveTab] = useState("card"); // "card" | "wallet" | "paypal"
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [walletAvailable, setWalletAvailable] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);

  // ── Init Stripe Payment Request (Google Pay / Apple Pay) ──
  useEffect(() => {
    if (!stripe || !amount) return;

    const pr = stripe.paymentRequest({
      country: "FR",
      currency: currency.toLowerCase(),
      total: {
        label: "BeautyBook",
        amount: Math.round(parseFloat(amount) * 100), // centimes
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setWalletAvailable(true);
        // Auto-select wallet tab if available
        setActiveTab("wallet");
      }
    });

    pr.on("paymentmethod", async (e) => {
      const { paymentMethod, complete } = e;
      try {
        complete("success");
        if (onSuccess) {
          await onSuccess({
            success: true,
            method: paymentMethod.card?.wallet?.type || "wallet", // "apple_pay" | "google_pay"
            paymentMethodId: paymentMethod.id,
            paymentMethod,
            brand: paymentMethod.card?.brand || "wallet",
            last4: paymentMethod.card?.last4 || "****",
            amount,
          });
        }
      } catch (err) {
        complete("fail");
        if (onError) onError(err);
      }
    });
  }, [stripe, amount, currency]);

  // ── Card submit ──
  const handleCardSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    setCardError("");

    try {
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
        billing_details: {
          name: customerName || "Client BeautyBook",
          email: customerEmail || undefined,
          phone: customerPhone || undefined,
        },
      });

      if (pmError) {
        setCardError(pmError.message || "Impossible de valider la carte bancaire.");
        if (onError) onError(pmError);
        setLoading(false);
        return;
      }

      const { token } = await stripe.createToken(cardElement);

      const result = {
        success: true,
        method: "card",
        paymentMethodId: paymentMethod.id,
        paymentMethod,
        token: token?.id,
        brand: paymentMethod?.card?.brand || "carte",
        last4: paymentMethod?.card?.last4 || "****",
        exp_month: paymentMethod?.card?.exp_month,
        exp_year: paymentMethod?.card?.exp_year,
        amount,
      };

      if (onSuccess) await onSuccess(result);
    } catch (err) {
      console.error("[Stripe] Erreur paiement:", err);
      const msg = err.message || "Erreur de communication avec Stripe.";
      setCardError(msg);
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Tabs config ──
  const tabs = [
    ...(walletAvailable
      ? [{ id: "wallet", label: "🍎  /  G Pay", icon: null }]
      : []),
    { id: "card", label: "💳 Carte", icon: null },
    { id: "paypal", label: "PayPal", icon: null },
  ];

  return (
    <div className="space-y-3">
      {/* ── Tab selector ── */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB : Google Pay / Apple Pay ══════════════ */}
      {activeTab === "wallet" && walletAvailable && paymentRequest && (
        <div className="space-y-3">
          <div className="bg-white border-2 border-orange-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-3 text-center">
              Payer en un clic
            </p>
            <PaymentRequestButtonElement
              options={{
                paymentRequest,
                style: {
                  paymentRequestButton: {
                    type: "buy",
                    theme: "dark",
                    height: "52px",
                  },
                },
              }}
            />
          </div>
          <SecurityBadge />
        </div>
      )}

      {/* ══════════════ TAB : Carte bancaire ══════════════ */}
      {activeTab === "card" && (
        <div className="space-y-3">
          <div className="bg-white border-2 border-orange-100/80 rounded-2xl p-4 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-black text-gray-800">
                  Formulaire de paiement Stripe
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                <span>CB</span> • <span>VISA</span> • <span>MC</span> •{" "}
                <span>AMEX</span>
              </div>
            </div>

            <div className="py-1">
              <CardElement
                options={{ ...STRIPE_CARD_STYLE, hidePostalCode: true }}
                onChange={(e) => {
                  setCardComplete(e.complete);
                  setCardError(e.error ? e.error.message : "");
                  if (onCardChange) onCardChange(e);
                }}
              />
            </div>

            <SecurityBadge className="mt-3 pt-3 border-t border-gray-100" />
          </div>

          {cardError && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-[12px] font-medium animate-in fade-in">
              ⚠️ {cardError}
            </div>
          )}

          {showSubmitButton && (
            <button
              type="button"
              onClick={handleCardSubmit}
              disabled={!stripe || !cardComplete || loading || isProcessing}
              className="w-full py-4 bg-primary hover:bg-primary/95 text-white rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-xl shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading || isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Traitement sécurisé Stripe...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>
                    {buttonLabel ||
                      (amount
                        ? `Payer ${amount} € avec Stripe`
                        : "Confirmer le paiement Stripe")}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ══════════════ TAB : PayPal ══════════════ */}
      {activeTab === "paypal" && (
        <div className="space-y-3">
          <div className="bg-white border-2 border-blue-100 rounded-2xl p-4 shadow-sm">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-3 text-center">
              Payer avec PayPal
            </p>
            <PayPalScriptProvider
              options={{
                clientId: PAYPAL_CLIENT_ID,
                currency: currency,
                intent: "capture",
              }}
            >
              <PayPalButtons
                style={{
                  layout: "vertical",
                  color: "gold",
                  shape: "pill",
                  label: "pay",
                  height: 50,
                }}
                forceReRender={[amount, currency]}
                createOrder={(data, actions) => {
                  return actions.order.create({
                    purchase_units: [
                      {
                        amount: {
                          value: parseFloat(amount || 0).toFixed(2),
                          currency_code: currency,
                        },
                        description: "Réservation BeautyBook",
                      },
                    ],
                  });
                }}
                onApprove={async (data, actions) => {
                  try {
                    const order = await actions.order.capture();
                    if (onSuccess) {
                      await onSuccess({
                        success: true,
                        method: "paypal",
                        paypalOrderId: order.id,
                        paypalStatus: order.status,
                        payerEmail: order.payer?.email_address,
                        payerName: `${order.payer?.name?.given_name || ""} ${order.payer?.name?.surname || ""}`.trim(),
                        amount,
                      });
                    }
                  } catch (err) {
                    if (onError) onError(err);
                  }
                }}
                onError={(err) => {
                  console.error("[PayPal] Erreur:", err);
                  if (onError) onError(err);
                }}
                onCancel={() => {
                  console.log("[PayPal] Paiement annulé par l'utilisateur");
                }}
              />
            </PayPalScriptProvider>
          </div>
          <SecurityBadge />
        </div>
      )}
    </div>
  );
}

/* ── Badge sécurité réutilisable ── */
function SecurityBadge({ className = "" }) {
  return (
    <div
      className={`flex items-center justify-between text-[10px] text-gray-400 font-medium ${className}`}
    >
      <div className="flex items-center gap-1 text-green-600 font-bold">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Sécurisé TLS 256 bits</span>
      </div>
      <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1">
        <Lock className="w-2.5 h-2.5" /> Stripe Direct
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Export — doit toujours être enveloppé dans <Elements>
   ══════════════════════════════════════════════════════════════════════════*/
export default function StripePaymentBox(props) {
  return (
    <Elements stripe={stripePromise}>
      <StripeCardFormInner {...props} />
    </Elements>
  );
}
