import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
  useEffect(() => { document.title = "Privacy Policy — StoriKids"; }, []);

  return (
    <div className="legal-page">
      <div className="legal-inner">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last updated: March 4, 2026</p>

        <p className="legal-intro">
          Hi there! We're the team behind StoriKids, and we take your family's privacy seriously.
          We built this product for parents like us, so we treat your data the way we'd want ours treated — with care,
          transparency, and respect. Here's exactly what we do (and don't do) with your information.
        </p>

        <h2>What we collect</h2>
        <p>When you use StoriKids, we collect:</p>
        <ul>
          <li><strong>Account info:</strong> Your name and email address when you sign up.</li>
          <li><strong>Story content:</strong> The character names, ages, roles, and story details you provide so we can create your storybook.</li>
          <li><strong>Uploaded photos:</strong> Character photos you choose to upload for personalized illustrations.</li>
          <li><strong>Usage data:</strong> Basic analytics about how you use the app (pages visited, features used) — only after you accept cookies.</li>
        </ul>

        <h2>How we use photos</h2>
        <p>
          When you upload a character photo, it's sent to our AI services (Claude by Anthropic) to generate a text description of the person's appearance.
          This description is then used to create consistent illustrated characters throughout your storybook.
          <strong> Photos are processed in real-time and are not stored permanently on our servers.</strong> They exist only for the duration of the story creation session.
        </p>

        <h2>We never sell your data. Ever.</h2>
        <p>
          This is non-negotiable. We don't sell, rent, or share your personal information with advertisers or data brokers.
          Your family's stories and photos are yours. Period.
        </p>

        <h2>How StoriKids works for families</h2>
        <p>
          StoriKids is a service designed for parents and guardians. When you create a story, you — the adult account holder — are
          providing your children's names and photos with your full knowledge and consent. We don't ask children to create accounts
          or provide information directly.
        </p>

        <h2>Children's privacy (COPPA)</h2>
        <p>
          We do not knowingly collect personal information directly from children under the age of 13.
          The account holder must be 18 years or older. All information about children (names, ages, photos) is provided by
          their parent or guardian through the parent's account. If you believe a child under 13 has somehow provided us information
          directly without parental consent, please contact us immediately and we will delete it.
        </p>

        <h2>Deleting your data</h2>
        <p>
          You're always in control. From your Account page, you can:
        </p>
        <ul>
          <li>Delete individual stories at any time</li>
          <li>Download all your data as a JSON file</li>
          <li>Delete all your stories at once</li>
          <li>Delete your entire account and all associated data</li>
        </ul>
        <p>When you delete something, it's gone. We don't keep shadow copies.</p>

        <h2>Cookies</h2>
        <p>
          We use essential cookies to keep you signed in and remember your preferences.
          We use PostHog for basic analytics — but only after you accept the cookie banner.
          We don't use tracking cookies for advertising.
        </p>

        <h2>Third-party services</h2>
        <ul>
          <li><strong>Clerk:</strong> Authentication (sign-in/sign-up)</li>
          <li><strong>Anthropic (Claude):</strong> Story generation and photo analysis</li>
          <li><strong>Replicate:</strong> AI illustration generation</li>
          <li><strong>ElevenLabs:</strong> Optional story narration</li>
          <li><strong>PostHog:</strong> Analytics (only with your consent)</li>
          <li><strong>Vercel:</strong> Hosting</li>
        </ul>

        <h2>Changes to this policy</h2>
        <p>
          If we make meaningful changes, we'll let you know via email or an in-app notification.
          We won't quietly change things — that's not how we roll.
        </p>

        <h2>Questions?</h2>
        <p>
          We're real people and we read every email. Reach out anytime:<br />
          <strong>privacy@storikids.com</strong>
        </p>
      </div>
    </div>
  );
}
