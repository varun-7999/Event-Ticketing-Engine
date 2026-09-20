import { Component } from "react";

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-xl border border-rose-500/30 bg-rose-500/10 p-6">
          <h1 className="text-xl font-semibold text-rose-200">The interface could not load</h1>
          <p className="mt-3 text-sm text-rose-300">{this.state.error.message}</p>
          <button
            className="mt-5 rounded-lg bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
