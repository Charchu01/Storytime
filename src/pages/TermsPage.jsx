import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function TermsPage() {
  useEffect(() => { document.title = "Terms of Service — StoriKids"; }, []);

  return (
    <div className="legal-page">
      <div className="legal-inner">
        <Link to="/" className="legal-back">← Back</Link>
        <h1 className="legal-h1">Terms of Service</h1>
        <p className="legal-updated">Last updated: March 4, 2026</p>

        <p className="legal-intro">
          Welcome to StoriKids! These terms are written in plain language because we believe you shouldn't
          need a law degree to understand how a children's storybook app works. Here's the deal:
        </p>

        <h2>Who can use StoriKids</h2>
        <p>
          You must be 18 years or older to create an account. StoriKids is designed for parents, grandparents,
          and guardians to create stories for the children in their lives. The little ones get to enjoy the stories —
          but the grown-ups run the account.
        </p>

        <h2>What you can do with your stories</h2>
        <p>
          The stories you create are yours to enjoy! You can read them, share them with family, download them as PDFs,
          and someday order printed copies. Your stories are for <strong>personal, non-commercial use only</strong>.
          That means you can share Emma's birthday story with grandma, but you can't sell it on Amazon.
        </p>

        <h2>How we use AI</h2>
        <p>
          StoriKids uses artificial intelligence to write stories and generate illustrations. While we work hard to make
          every story wonderful, AI can sometimes produce unexpected results. We recommend parents review each story
          before sharing it with children — think of it as a final read-through before bedtime.
        </p>

        <h2>Your content</h2>
        <p>
          You own the content you create — your character details, your story preferences, your uploaded photos.
          We don't claim ownership of your stories. We need a limited license to actually provide the service
          (storing your stories, generating illustrations, etc.), but that's it.
        </p>

        <h2>Acceptable use</h2>
        <p>Please use StoriKids the way it's intended — to create wonderful stories for kids. Don't use it to:</p>
        <ul>
          <li>Create harmful, abusive, or inappropriate content</li>
          <li>Upload photos of people without their consent (or their parent's consent for minors)</li>
          <li>Attempt to circumvent our safety measures</li>
          <li>Use the service for any illegal purpose</li>
          <li>Reverse-engineer or scrape the service</li>
        </ul>

        <h2>How we improve the product</h2>
        <p>
          We may use anonymized, non-identifiable usage patterns to improve StoriKids. For example, we might analyze
          which art styles are most popular or how long story generation takes — but we never use your personal stories,
          names, or photos for this purpose. It's all aggregate, anonymous data.
        </p>

        <h2>Availability</h2>
        <p>
          We do our best to keep StoriKids running smoothly, but we can't guarantee 100% uptime. Sometimes we need to
          do maintenance, and occasionally things break (we're human!). We're not liable for any downtime or service interruptions.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. If we make significant changes, we'll notify you via email
          or an in-app message. Continued use after changes means you accept the new terms.
        </p>

        <h2>Getting in touch</h2>
        <p>
          Questions about these terms? We're always happy to chat:<br />
          <strong>hello@storikids.com</strong>
        </p>
      </div>
    </div>
  );
}
