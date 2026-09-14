'use client';
import { useState } from 'react';
import { Code2, Copy, FileText, MapPin, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function TripOnboarding({ onLoad, onBlank, onPaste }: { onLoad: () => void; onBlank: () => void; onPaste: () => void }) {
  const [copyState, setCopyState] = useState('');
  const [fallback, setFallback] = useState('');
  async function copyPrompt() {
    setCopyState('Preparing prompt…');
    try {
      const response = await fetch('/format.md');
      if (!response.ok) throw new Error('Could not load the trip format. Open the format guide below.');
      const prompt = `Help me plan a trip and produce a downloadable destination-trip.yaml file for Roamwise. Ask for any essential travel preferences first. Follow the complete format below. Preserve my chosen options, use stable IDs, and include reliable coordinates when available. Omit unknown prices; zero means free. Clearly label estimates and never invent current fares or availability. Include selected activity IDs so they appear in the final itinerary. Return the YAML file and a short explanation of any missing information.\n\n${await response.text()}`;
      try { await navigator.clipboard.writeText(prompt); setCopyState('Copied — paste it into your AI chat.'); }
      catch { setFallback(prompt); setCopyState('Select and copy the prompt below.'); }
    } catch (error) { setCopyState(error instanceof Error ? error.message : 'Could not prepare the prompt.'); }
  }
  return <div className="space-y-5">
    <div className="rounded-3xl border border-dashed bg-[#fafaf8] px-6 py-10 text-center sm:px-10">
      <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-black text-white"><MapPin size={22} /></div>
      <h1 className="text-3xl font-semibold tracking-tight">Your trip, brought to life.</h1>
      <p className="mx-auto mt-3 max-w-md text-base leading-7 text-black/60">Drop a trip YAML file here to explore the map, compare options, and see each day’s plan.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onLoad} className="bg-black text-white"><Upload /> Load trip file</Button>
        <Button onClick={onPaste} variant="outline"><FileText /> Paste YAML</Button>
        <Button onClick={onBlank} variant="ghost"><Plus /> Start blank</Button>
      </div>
      <p className="mt-5 text-sm leading-6 text-black/50">Your YAML stays in this browser. Maps and remote images connect to their providers.</p>
    </div>
    <div className="rounded-2xl border p-6">
      <h2 className="text-lg font-semibold">Start with your AI</h2>
      <p className="mt-2 text-base leading-7 text-black/60">Give ChatGPT, Claude, or another assistant the trip format, then bring its YAML file back here.</p>
      <Button onClick={() => void copyPrompt()} variant="outline" className="mt-4"><Copy /> Copy prompt for your AI</Button>
      {copyState && <output className="mt-3 block text-sm">{copyState}</output>}
      {fallback && <Textarea aria-label="Trip generation prompt" value={fallback} readOnly onFocus={event => event.currentTarget.select()} className="mt-3 h-48 font-mono" />}
      <div className="mt-5 flex flex-wrap gap-5 text-sm underline underline-offset-4"><a href="/trips/seville.trip.yaml" download>Full Spain demo</a><a href="/format.md" target="_blank" rel="noreferrer">Format guide</a><a href="/trip.schema.json" target="_blank" rel="noreferrer">JSON Schema</a></div>
    </div>
    <p className="text-sm"><a href="/downloads/roamwise-cli-0.1.0.tgz" download className="underline underline-offset-4">Download a CLI release tarball</a> · Node.js 22.13 or newer</p>
    <a href="/setup.md" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border p-5 text-sm hover:bg-neutral-50"><Code2 className="shrink-0" /><span><strong className="block">Use with Codex, Claude Code, or Cursor</strong><span className="mt-1 block text-black/60">Add the Roamwise skill. Your agent runs the CLI on demand through npx.</span></span></a>
  </div>;
}
