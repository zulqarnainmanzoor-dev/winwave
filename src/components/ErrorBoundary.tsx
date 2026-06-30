import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-white p-4">
          <div className="max-w-md w-full bg-[#161618] rounded-2xl p-6 border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-4">
              The app encountered an unexpected error. Please refresh the page or try again later.
            </p>
            {this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">
                  Technical details
                </summary>
                <pre className="mt-2 text-xs text-red-300 bg-red-500/10 p-3 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-xl transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
