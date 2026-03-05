import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../stripe";
import { createPaymentIntent } from "../api/client";

function PaymentForm({ onSuccess, price, tier }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message);
      setProcessing(false);
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message);
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess();
    } else {
      setError("Payment was not completed. Please try again.");
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pw-form">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <div className="pw-error">{error}</div>}
      <button
        type="submit"
        className="pw-pay-btn"
        disabled={!stripe || processing}
      >
        {processing ? "Processing..." : `Create My Book — ${price}`}
      </button>
    </form>
  );
}

export default function Paywall({ bookType, artStyle, heroData, wizardData, onPaid, storySessionId }) {
  const [selectedTier, setSelectedTier] = useState("standard");
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const price = selectedTier === "premium" ? "$19.99" : "$9.99";
  const pageCount = selectedTier === "premium"
    ? (bookType?.pageCount?.premium || 10)
    : (bookType?.pageCount?.standard || 6);

  function handleProceedToPayment() {
    setShowPayment(true);
    setLoading(true);
    setError(null);

    createPaymentIntent(selectedTier, storySessionId)
      .then((secret) => {
        setClientSecret(secret);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  const heroName = heroData?.heroName || wizardData?.heroName || "Your hero";
  const styleName = artStyle?.style?.name || "Classic Storybook";
  const bookTitle = bookType?.title || "Adventure Story";

  return (
    <div className="pw-screen">
      <div className="pw-content">
        <div className="pw-sparkle-icon">✨</div>
        <h1 className="pw-headline">Your story is ready to create!</h1>

        {/* Summary card */}
        <div className="pw-summary">
          <div className="pw-summary-hero">{heroName}'s {bookTitle}</div>
          <div className="pw-summary-details">
            <span className="pw-summary-tag">{artStyle?.style?.name || styleName}</span>
            {artStyle?.tone && <span className="pw-summary-tag">{artStyle.tone.label}</span>}
            <span className="pw-summary-tag">{bookType?.emoji} {bookType?.title}</span>
          </div>
        </div>

        {/* Tier selection */}
        {!showPayment && (
          <>
            <div className="pw-tiers">
              <button
                className={`pw-tier-card${selectedTier === "standard" ? " pw-tier-selected" : ""}`}
                onClick={() => setSelectedTier("standard")}
              >
                <div className="pw-tier-name">Standard</div>
                <div className="pw-tier-price">$9.99</div>
                <div className="pw-tier-pages">{bookType?.pageCount?.standard || 6} pages</div>
              </button>

              <button
                className={`pw-tier-card pw-tier-premium${selectedTier === "premium" ? " pw-tier-selected" : ""}`}
                onClick={() => setSelectedTier("premium")}
              >
                <div className="pw-tier-badge">Best Value</div>
                <div className="pw-tier-name">Premium</div>
                <div className="pw-tier-price">$19.99</div>
                <div className="pw-tier-pages">{bookType?.pageCount?.premium || 10} pages</div>
                <div className="pw-tier-perks">Best quality · Family Vault</div>
              </button>
            </div>

            <button className="pw-pay-btn pw-proceed-btn" onClick={handleProceedToPayment}>
              Continue — {price}
            </button>
          </>
        )}

        {/* Payment form */}
        {showPayment && (
          <div className="pw-payment-section">
            {loading && (
              <div className="pw-loading">Setting up secure payment...</div>
            )}

            {error && (
              <div className="pw-error">
                Hmm, something went wrong setting up payment. Please try again!
              </div>
            )}

            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "night",
                    variables: {
                      colorPrimary: "#F59E0B",
                      borderRadius: "12px",
                    },
                  },
                }}
              >
                <PaymentForm
                  onSuccess={() => onPaid(selectedTier)}
                  price={price}
                  tier={selectedTier}
                />
              </Elements>
            )}
          </div>
        )}

        <p className="pw-fine">
          One-time payment · Instant access · No subscription
        </p>
      </div>
    </div>
  );
}
