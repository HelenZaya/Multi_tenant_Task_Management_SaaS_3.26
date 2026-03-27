import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center px-4">
          <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
            <h1 className="text-2xl font-semibold">Unexpected UI failure</h1>
            <p className="mt-3 text-sm text-slate-300">Refresh the page. If the issue persists, check the backend logs and request id.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
