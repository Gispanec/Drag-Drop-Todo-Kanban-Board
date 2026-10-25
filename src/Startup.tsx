import { Component, useEffect } from 'react';
import type { ReactNode } from 'react';
import App from './App';
import type { BoardStore } from './state/store';

class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    window.dispatchEvent(new CustomEvent('flow:failure', {
      detail: { stage: 'react', name: error.name, message: error.message },
    }));
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function ReadyMarker() {
  useEffect(() => { window.dispatchEvent(new Event('flow:ready')); }, []);
  return null;
}

export default function Startup({ store }: { store: BoardStore }) {
  return <AppBoundary><App store={store} /><ReadyMarker /></AppBoundary>;
}
