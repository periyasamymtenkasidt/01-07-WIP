import { Component } from "react";

// Catches render/lazy-chunk failures anywhere below it so a single
// broken component shows a recoverable fallback instead of a blank screen.
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Replace with a real error-tracking service (Sentry, etc.) later.
    console.error("ErrorBoundary caught an error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-overallbg p-6 font-manrope">
          <div className="max-w-md w-full text-center bg-surface border border-bordergray rounded-2xl shadow-sm px-8 py-10">
            <h1 className="text-2xl font-bold text-textcolor mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-text-muted mb-6">
              An unexpected error occurred while loading this page. Try
              reloading — if it keeps happening, contact support.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
