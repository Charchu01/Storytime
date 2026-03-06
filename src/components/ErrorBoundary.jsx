import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div className="eb-container">
          <div className="eb-card">
            <div className="eb-icon">📖</div>
            <h1 className="eb-title">Something went wrong</h1>
            <p className="eb-message">
              {this.props.message || "Don\u2019t worry \u2014 your story is safe. Try reloading the page."}
            </p>
            <div className="eb-actions">
              <button className="eb-reload" onClick={this.handleReload}>
                Reload Page
              </button>
              {this.props.onBack && (
                <button className="eb-back" onClick={this.props.onBack}>
                  Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
