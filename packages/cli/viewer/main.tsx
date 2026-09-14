import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import AgentPreview from '../../../components/agent-preview';
import '../../../app/globals.css';
import './local.css';

function subscribeToSession(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
function currentSession() { return new URLSearchParams(window.location.hash.slice(1)).get('session'); }
function LocalPreview() {
  const session = useSyncExternalStore(subscribeToSession, currentSession);
  return session ? <AgentPreview key={session} session={session} /> : <main className="mx-auto max-w-xl p-10"><h1 className="text-2xl font-semibold">Roamwise</h1><p className="mt-4">Open a trip from your agent or terminal:</p><pre className="mt-4 rounded-xl bg-neutral-100 p-4">roamwise open seville-trip.yaml</pre></main>;
}
createRoot(document.getElementById('root')!).render(<LocalPreview />);
