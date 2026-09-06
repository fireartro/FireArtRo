import { Component } from "react";

// An optional visual must never take the page down if its lazy chunk fails.
export default class SceneBoundary extends Component {
  state = { unavailable: false };
  static getDerivedStateFromError() { return { unavailable: true }; }
  componentDidCatch() { this.props.onUnavailable?.(); }
  render() { return this.state.unavailable ? null : this.props.children; }
}
