// Create: src/components/intake/IntakeErrorBoundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class IntakeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Intake flow error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
          <div className="glass-panel p-8 rounded-xl text-center">
            <h2 className="text-xl font-bold text-white mb-4">Navigation Error</h2>
            <p className="text-white/80 mb-4">Something went wrong during navigation.</p>
            <button 
              onClick={() => window.location.href = '/intake/personality'}
              className="glass-button px-6 py-2 rounded-lg text-white hover:bg-white/10 transition-all"
            >
              Restart Intake Process
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default IntakeErrorBoundary;
