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
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {error && <div className="pw-error">{error}</div>}
      <button
        type="submit"
        className="pw-pay-btn"
        disabled={!stripe || processing}
      >
        {processing ? "Processing..." : `Unlock My Story — ${price}`}
      </button>
    </form>
  );
}

export default function Paywall({ tier, previewImageUrl, pageCount, price, onPaid, storySessionId }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    createPaymentIntent(tier, storySessionId)
      .then((secret) => {
        setClientSecret(secret);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [tier, storySessionId]);

  return (
    <div className="pw-overlay">
      <div className="pw-modal">
        <div className="pw-header">
          <div className="pw-sparkle">✨</div>
          <h2 className="pw-title">Your story is ready!</h2>
          <p className="pw-subtitle">Here's a sneak peek of page 1...</p>
        </div>

        {previewImageUrl && (
          <div className="pw-preview">
            <img src={previewImageUrl} alt="Page 1 preview" className="pw-preview-img" />
          </div>
        )}

        <div className="pw-unlock">
          <div className="pw-lock-icon">🔒</div>
          <div className="pw-unlock-text">
            Unlock all {pageCount} pages
          </div>
          <div className="pw-price">{price}</div>
        </div>

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
            <PaymentForm onSuccess={onPaid} price={price} tier={tier} />
          </Elements>
        )}

        <p className="pw-fine">
          One-time payment · Instant access · No subscription
        </p>
      </div>
    </div>
  );
}
