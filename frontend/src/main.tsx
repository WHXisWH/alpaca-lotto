import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import AppWrapper from './AppWrapper';

// Error boundary to catch and display rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error information
    console.error('Application error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <div className="error-boundary">
          <div className="error-container">
            <h1>😱 Something went wrong</h1>
            <p>The application encountered an unexpected error. Please try refreshing the page.</p>
            <div className="error-details">
              <h3>Error Details</h3>
              <p className="error-message">{this.state.error?.toString()}</p>
              <code className="error-stack">
                {this.state.errorInfo?.componentStack}
              </code>
            </div>
            <button 
              className="refresh-button"
              onClick={() => window.location.reload()}
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

// Add error listener for unhandled exceptions
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

// Add promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Create root and render app with error boundary
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppWrapper />
    </ErrorBoundary>
  </React.StrictMode>
);