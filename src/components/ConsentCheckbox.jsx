import { Link } from "react-router-dom";

export default function ConsentCheckbox({ checked, onChange, error }) {
  return (
    <div className={`consent-wrap${error ? " consent-error" : ""}`}>
      <label className="consent-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="consent-cb"
        />
        <span className="consent-text">
          I confirm I am the parent or guardian of the child in these photos,
          and I consent to their use for generating a personalized storybook.{" "}
          <Link to="/privacy" target="_blank" className="consent-link">
            Privacy Policy
          </Link>
        </span>
      </label>
      {error && (
        <div className="consent-err-msg">
          Please confirm parental consent before uploading photos
        </div>
      )}
    </div>
  );
}
