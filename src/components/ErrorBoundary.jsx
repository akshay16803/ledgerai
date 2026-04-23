import { Component } from 'react';

/**
 * React Error Boundary — catches render-time exceptions that would otherwise
 * unmount the entire React tree and leave the user staring at a blank page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 * Or wrap individual routes so a crash on one page doesn't take down the
 * sidebar / nav:
 *   <ErrorBoundary><Dashboard /></ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console so devs can debug from browser tools
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: this.props.fullScreen !== false ? '100vh' : 400,
          background: 'var(--bg-primary, #fafaf8)', padding: 32,
        }}>
          <div style={{
            background: '#fff', border: '1px solid var(--border-subtle, #e5e5e3)',
            borderRadius: 2, padding: '48px 40px', maxWidth: 480,
            textAlign: 'center', width: '100%',
          }}>
            <div style={{
              fontSize: 32, marginBottom: 16, lineHeight: 1,
              color: 'var(--error, #FF3B30)',
            }}>
              Something went wrong
            </div>
            <p style={{
              fontSize: 14, color: 'var(--text-muted, #8a8a85)',
              lineHeight: 1.6, marginBottom: 24,
            }}>
              This page ran into an unexpected error. You can try reloading, or
              go back to the dashboard.
            </p>
            {this.state.error && (
              <pre style={{
                fontSize: 11, color: 'var(--text-muted, #8a8a85)',
                background: 'var(--bg-secondary, #f0f0ec)', padding: 12,
                borderRadius: 2, marginBottom: 24, textAlign: 'left',
                overflowX: 'auto', maxHeight: 120,
                fontFamily: 'var(--font-mono, monospace)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {String(this.state.error)}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={this.handleReset} style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-body, system-ui)', cursor: 'pointer',
                background: '#fff', color: 'var(--text-primary, #1A1A18)',
                border: '1px solid var(--border-strong, #d4d4d0)', borderRadius: 2,
              }}>
                Try Again
              </button>
              <button onClick={this.handleGoHome} style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 600,
                fontFamily: 'var(--font-body, system-ui)', cursor: 'pointer',
                background: 'var(--brand-primary, #34C759)', color: '#fff',
                border: 'none', borderRadius: 2,
              }}>
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
