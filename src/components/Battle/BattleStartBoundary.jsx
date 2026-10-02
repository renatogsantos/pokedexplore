"use client";
import { Component } from 'react';
import { traceBattleStartError } from '@/lib/battle/startTrace';
export function BattleStartFailure({ onRetry, onBack }) {
  return <section className="battle-start-error" role="alert"><h2>Não foi possível iniciar a batalha</h2><p>Seus dados continuam salvos.</p><button type="button" onClick={onRetry}>Tentar novamente</button><button type="button" onClick={onBack}>Voltar</button></section>;
}
export default class BattleStartBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) {
    traceBattleStartError('ARENA_RENDER_FAILED', error, { matchId: this.props.matchId, componentStack: info.componentStack });
    console.error('[battle] Arena render failed', { name: error.name, message: error.message, matchId: this.props.matchId });
  }
  render() {
    return this.state.failed ? <BattleStartFailure onRetry={() => this.setState({ failed: false })} onBack={this.props.onBack} /> : this.props.children;
  }
}
