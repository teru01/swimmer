import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | undefined;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Catches unhandled errors in the React component tree and displays a fallback UI.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '16px',
            padding: '24px',
            backgroundColor: 'var(--bg-primary, #1e1e1e)',
            color: 'var(--text-primary, #ffffff)',
          }}
        >
          <h2>An unexpected error occurred</h2>
          <p
            style={{
              color: 'var(--text-secondary, #cccccc)',
              maxWidth: '500px',
              textAlign: 'center',
            }}
          >
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button onClick={this.handleReload}>Reload Application</button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
