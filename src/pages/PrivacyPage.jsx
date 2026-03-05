import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
  useEffect(() => { document.title = "Privacy Policy — StoriKids"; }, []);

  return (
    <div className="legal-page">
      <div className="legal-inner">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last updated: March 5, 2026</p>

        <p className="legal-intro">
          Hi there! We're the team behind StoriKids, and we take your family's privacy seriously.
          We built this product for parents like us, so we treat your data the way we'd want ours treated — with care,
          transparency, and respect. Here's exactly what we do (and don't do) with your information.
        </p>

        <h2>What we collect</h2>
        <p>When you use StoriKids, we collect:</p>
        <ul>
          <li><strong>Account info:</strong> Your name and email address when you sign up (optional — the app works without an account).</li>
          <li><strong>Child's information (provided by parent):</strong> Your child's name, age, and role in the story. This is entered by you, the parent or guardian.</li>
          <li><strong>Uploaded photos:</strong> Photos of your child that you choose to upload for personalized illustrations. These are provided with your explicit parental consent.</li>
          <li><strong>Payment info:</strong> Processed securely by Stripe. We never see or store your full credit card number.</li>
          <li><strong>Story content:</strong> Character details and story preferences you provide so we can create your storybook.</li>
          <li><strong>Usage data:</strong> Basic analytics about how you use the app (pages visited, features used) — only after you accept cookies.</li>
        </ul>

        <h2>How we use photos</h2>
        <p>
          When you upload a character photo, here is exactly what happens:
        </p>
        <ul>
          <li><strong>Standard stories ($9.99):</strong> Photos are sent to Anthropic (Claude) for a text description of your child's appearance, then to Replicate for face-preserving illustration generation. Photos are processed in real-time and are <strong>not stored permanently</strong>. They exist only for the duration of the story creation session.</li>
          <li><strong>Premium stories ($19.99):</strong> Photos are used to train a custom AI model (LoRA) on your child's face for perfect consistency. The trained model weights are saved to your Family Vault in Vercel KV so future stories can reuse them without re-uploading photos. Original photos are <strong>deleted within 48 hours</strong> of processing.</li>
        </ul>
        <p>
          <strong>COPPA Parental Consent:</strong> Before any photos are processed, we require explicit consent via a checkbox confirming you are the parent or legal guardian of the child in the photos and consent to their use for generating personalized storybook illustrations.
        </p>

        <h2>Who sees your data</h2>
        <p>Your data is shared only with the services needed to create your storybook:</p>
        <ul>
          <li><strong>Anthropic (Claude):</strong> Receives character names, ages, story preferences, and photo descriptions to generate story text.</li>
          <li><strong>Replicate:</strong> Receives photos for AI illustration generation and LoRA model training (Premium only).</li>
          <li><strong>Stripe:</strong> Processes payments securely. We never handle or store raw card data.</li>
          <li><strong>Vercel:</strong> Hosts the application and Vercel KV stores Family Vault data (Premium trained models).</li>
          <li><strong>Clerk:</strong> Authentication (sign-in/sign-up), if you choose to create an account.</li>
        </ul>

        <h2>We never sell your data. Ever.</h2>
        <p>
          This is non-negotiable. We don't sell, rent, or share your personal information with advertisers or data brokers.
          Your family's stories and photos are yours. Period. There is <strong>no third-party advertising</strong> on StoriKids,
          and we will never monetize your family's data.
        </p>

        <h2>Data retention</h2>
        <ul>
          <li><strong>Uploaded photos:</strong> Processed and deleted within 48 hours of story creation.</li>
          <li><strong>Generated story images:</strong> Stored for 48 hours on Replicate's servers, then deleted. Stories saved in your browser's local storage persist until you delete them.</li>
          <li><strong>Trained LoRA models (Premium):</strong> Stored in your Family Vault until you delete them. You can delete any character from your vault at any time.</li>
          <li><strong>Payment records:</strong> Retained by Stripe per their data retention policy for legal/financial compliance.</li>
          <li><strong>Story data:</strong> Stored locally in your browser. We do not have a copy unless you share it.</li>
        </ul>

        <h2>Children's privacy (COPPA compliance)</h2>
        <p>
          StoriKids is a service directed at <strong>parents and guardians</strong>, not at children under 13.
          We comply with the Children's Online Privacy Protection Act (COPPA):
        </p>
        <ul>
          <li>We do <strong>not</strong> knowingly collect personal information directly from children under the age of 13.</li>
          <li>The account holder must be 18 years or older.</li>
          <li>All information about children (names, ages, photos) is provided by their parent or guardian through the parent's account, with explicit consent.</li>
          <li>We require verifiable parental consent (consent checkbox) before processing any child's photos.</li>
          <li>A parent may review, request deletion of, or refuse further collection of their child's personal information at any time by contacting us.</li>
          <li>If you believe a child under 13 has somehow provided us information directly without parental consent, please contact us immediately and we will delete it.</li>
        </ul>

        <h2>Your rights and controls</h2>
        <p>You're always in control:</p>
        <ul>
          <li>Delete individual stories at any time from your Library</li>
          <li>Delete saved characters from your Family Vault</li>
          <li>Request deletion of any data by emailing <strong>dom@ready.cards</strong></li>
          <li>Delete your entire account and all associated data</li>
        </ul>
        <p>When you delete something, it's gone. We don't keep shadow copies.</p>

        <h2>Cookies</h2>
        <p>
          We use essential cookies to keep you signed in and remember your preferences.
          We use PostHog for basic analytics — but only after you accept the cookie banner.
          We don't use tracking cookies for advertising.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we make meaningful changes, we'll let you know via email or an in-app notification.
          We won't quietly change things — that's not how we roll.
        </p>

        <h2>Questions?</h2>
        <p>
          We're real people and we read every email. Reach out anytime:<br />
          <strong>dom@ready.cards</strong>
        </p>
      </div>
    </div>
  );
}
