'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary wraps any subtree and catches synchronous render errors.
 * Place it at the route level to prevent a single broken component from
 * crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeRiskyComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this should send to Sentry / DataDog / your observability stack
    console.error('[ErrorBoundary] Uncaught render error', {
      message: error.message,
      componentStack: info.componentStack,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              An unexpected error occurred. Our team has been notified. Please
              try refreshing the page.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="mt-4 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs text-destructive">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.handleReset}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload page</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
