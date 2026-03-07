import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../stripe";
import { createPaymentIntent } from "../api/client";

function PaymentForm({ onSuccess, heroName }) {
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
      <button type="submit" className="pw-pay-btn" disabled={!stripe || processing}>
        {processing ? "Processing..." : `Create ${heroName}'s Book \u2014 $19.99`}
      </button>
    </form>
  );
}

export default function Paywall({ bookType, artStyle, heroData, wizardData, onPaid, storySessionId }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const heroName = heroData?.heroName || wizardData?.heroName || "Your hero";

  function handleProceedToPayment() {
    // Prevent multiple payment intents from rapid clicks
    if (loading || clientSecret) return;
    setShowPayment(true);
    setLoading(true);
    setError(null);

    createPaymentIntent("premium", storySessionId)
      .then((secret) => {
        setClientSecret(secret);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  return (
    <div className="create-step">
      <div className="pw-page">
        <h1 className="pw-heading">Your book is ready to come alive</h1>

        {/* Hero summary card */}
        <div className="pw-hero-card">
          <div className="pw-hero-left">
            {heroData?.heroPhoto ? (
              <div className="pw-hero-photo">
                <img src={heroData.heroPhoto} alt={heroName} />
              </div>
            ) : (
              <div className="pw-hero-emoji">{bookType?.emoji || "\uD83D\uDCD6"}</div>
            )}
          </div>
          <div className="pw-hero-right">
            <h2 className="pw-hero-title">{heroName}'s {bookType?.title || "Story"}</h2>
            <p className="pw-hero-details">
              {artStyle?.style?.name}{artStyle?.tone ? ` \u00B7 ${artStyle.tone.label}` : ""}
            </p>
            {heroData?.companions?.length > 0 && (
              <p className="pw-hero-companions">
                Co-starring {heroData.companions.map(c => c.name).join(" & ")}
              </p>
            )}
          </div>
        </div>

        {/* What you get */}
        <div className="pw-includes">
          <h3 className="pw-includes-title">Everything included</h3>
          <div className="pw-includes-list">
            <div className="pw-include-item">
              <span className="pw-include-icon">{"\uD83C\uDFA8"}</span>
              <div className="pw-include-text">
                <strong>10 illustrated pages</strong>
                <span>Every page uniquely painted by AI</span>
              </div>
            </div>
            <div className="pw-include-item">
              <span className="pw-include-icon">{"\uD83D\uDCD6"}</span>
              <div className="pw-include-text">
                <strong>Digital storybook</strong>
                <span>Read on any device, share with family</span>
              </div>
            </div>
            <div className="pw-include-item">
              <span className="pw-include-icon">{"\uD83D\uDD0A"}</span>
              <div className="pw-include-text">
                <strong>AI narration</strong>
                <span>A warm voice reads the story aloud</span>
              </div>
            </div>
            <div className="pw-include-item">
              <span className="pw-include-icon">{"\uD83D\uDCC4"}</span>
              <div className="pw-include-text">
                <strong>PDF download</strong>
                <span>Print-ready quality, yours forever</span>
              </div>
            </div>
            <div className="pw-include-item">
              <span className="pw-include-icon">{"\uD83C\uDFF0"}</span>
              <div className="pw-include-text">
                <strong>Family Vault</strong>
                <span>Save characters for future books</span>
              </div>
            </div>
          </div>
        </div>

        {/* Physical book teaser */}
        <div className="pw-physical">
          <div className="pw-physical-badge">COMING SOON</div>
          <div className="pw-physical-content">
            <div className="pw-physical-icon">{"\uD83D\uDCDA"}</div>
            <div className="pw-physical-text">
              <h4 className="pw-physical-title">Turn it into a real hardcover book</h4>
              <p className="pw-physical-desc">
                Premium printed {"\u00B7"} Delivered in days {"\u00B7"} The perfect keepsake
              </p>
              <p className="pw-physical-price">
                Other personalised books cost $47+. Yours starts at <strong>$19.99</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Price + CTA */}
        {!showPayment && (
          <div className="pw-price-section">
            <div className="pw-price-display">
              <span className="pw-price-amount">$19.99</span>
              <span className="pw-price-label">one-time payment</span>
            </div>
            <button className="pw-cta-btn" onClick={handleProceedToPayment}>
              Create {heroName}'s Book {"\u2728"}
            </button>
          </div>
        )}

        {/* Payment form */}
        {showPayment && (
          <div className="pw-payment-section">
            {loading && <div className="pw-loading">Setting up secure payment...</div>}
            {error && (
              <div className="pw-error">
                Hmm, something went wrong setting up payment.
                <button className="pw-retry-btn" onClick={() => { setClientSecret(null); setShowPayment(false); setError(null); }}>
                  Try Again
                </button>
              </div>
            )}
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
                <PaymentForm onSuccess={() => onPaid("premium")} heroName={heroName} />
              </Elements>
            )}
          </div>
        )}

        {/* Trust signals */}
        <div className="pw-trust">
          <div className="pw-trust-row">
            <span>{"\uD83D\uDD12"} Secured by Stripe</span>
            <span>{"\u00B7"}</span>
            <span>{"\uD83D\uDCB3"} One-time payment</span>
            <span>{"\u00B7"}</span>
            <span>{"\u26A1"} Book ready in minutes</span>
          </div>
          <p className="pw-trust-guarantee">
            Not happy? We'll make it right. No questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}
