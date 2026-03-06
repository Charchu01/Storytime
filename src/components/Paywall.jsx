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
      <button type="submit" className="create-continue-btn pw-pay-btn" disabled={!stripe || processing}>
        {processing ? "Processing..." : `Create My Book \u2014 ${price}`}
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
  const toneName = artStyle?.tone?.label || null;

  return (
    <div className="create-step">
      <div className="create-step-content create-step-content--narrow">
        <h1 className="create-step-title">One last step!</h1>
        <p className="create-step-subtitle">Choose your package and let's make magic</p>

        {/* Emotional hook — summary card */}
        <div className="pw-summary">
          <div className="pw-summary-icon">{bookType?.emoji || "\uD83D\uDCD6"}</div>
          <div className="pw-summary-text">
            <div className="pw-summary-hero">{heroName}'s {bookTitle}</div>
            <div className="pw-summary-details">
              {styleName}{toneName ? ` \u00B7 ${toneName}` : ""}
            </div>
            {heroData?.companions?.length > 0 && (
              <div className="pw-summary-companions">
                With {heroData.companions.map(c => c.name).join(" & ")}
              </div>
            )}
          </div>
        </div>

        {/* Tier selection */}
        {!showPayment && (
          <>
            <div className="pw-tiers">
              <button className={`pw-tier${selectedTier === "standard" ? " pw-tier--selected" : ""}`} onClick={() => setSelectedTier("standard")}>
                <div className="pw-tier-label">Standard</div>
                <div className="pw-tier-price">$9.99</div>
                <div className="pw-tier-pages">{bookType?.pageCount?.standard || 6} illustrated pages</div>
                <ul className="pw-tier-features">
                  <li>AI-generated illustrations</li>
                  <li>Personalized story</li>
                  <li>PDF download</li>
                </ul>
              </button>

              <button className={`pw-tier pw-tier--premium${selectedTier === "premium" ? " pw-tier--selected" : ""}`} onClick={() => setSelectedTier("premium")}>
                <div className="pw-tier-badge">Best Value</div>
                <div className="pw-tier-label">Premium</div>
                <div className="pw-tier-price">$19.99</div>
                <div className="pw-tier-pages">{bookType?.pageCount?.premium || 10} illustrated pages + Family Vault</div>
                <ul className="pw-tier-features">
                  <li>Everything in Standard</li>
                  <li>More pages & detail</li>
                  <li>Family Vault access</li>
                  <li>Priority generation</li>
                </ul>
              </button>
            </div>

            <button className="create-continue-btn" onClick={handleProceedToPayment}>
              Continue &mdash; {price}
            </button>
          </>
        )}

        {/* Payment form */}
        {showPayment && (
          <div className="pw-payment-section">
            {loading && <div className="pw-loading">Setting up secure payment...</div>}
            {error && <div className="pw-error">Hmm, something went wrong setting up payment. Please try again!</div>}
            {clientSecret && (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "flat",
                    variables: {
                      colorPrimary: "#C85D2A",
                      colorBackground: "#FFFFFF",
                      colorText: "#2D1B0E",
                      borderRadius: "12px",
                      fontFamily: "'DM Sans', -apple-system, sans-serif",
                    },
                  },
                }}
              >
                <PaymentForm onSuccess={() => onPaid(selectedTier)} price={price} tier={selectedTier} />
              </Elements>
            )}
          </div>
        )}

        <p className="pw-trust">{"\uD83D\uDD12"} Secure payment {"\u00B7"} One-time {"\u00B7"} No subscription</p>
      </div>
    </div>
  );
}
