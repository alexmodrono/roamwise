'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, Copy, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function LandingPromptDialog({ kind, hero = false }: { kind: 'trip' | 'agent'; hero?: boolean }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const agent = kind === 'agent';

  async function loadPrompt() {
    setLoading(true);
    setError('');
    try {
      if (agent) {
        setPrompt(`You are a coding agent setting up Roamwise as a trip-planning companion. Install the Roamwise skill first using the Skills CLI.

1. Find the Roamwise repository source provided by the user or configured in the current checkout. From a Roamwise source checkout, run:

   npx skills add ./skills/roamwise --skill roamwise -y

   Otherwise, use the confirmed public GitHub repository URL:

   npx skills add <ROAMWISE_REPOSITORY_URL> --skill roamwise -y

   Replace the placeholder before running the command. If no repository source is available, ask the user for it; do not guess the repository or package name. Install into the current project, using the installer's agent selection if needed.

2. Read the installed roamwise SKILL.md and follow its instructions. Let the skill handle runtime installation, trip creation, validation, preview startup, and subsequent updates. Do not duplicate that workflow or install the Roamwise CLI globally.

3. Continue with the user's trip-planning request using the skill. If installation fails, report the actual error and resolve the skill installation before proceeding.`);
      } else {
        const response = await fetch('/format.md');
        if (!response.ok) throw new Error('Could not load the prompt. Please try again.');
        const guide = await response.text();
        setPrompt(`Help me plan a trip and create a downloadable trip.yaml file for Roamwise. Ask me about destination, dates, travellers and budget first. Use the format below. Omit unknown prices and never invent current fares or availability. Include selected activity IDs and reliable coordinates when available.\n\n${guide}`);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not load the prompt. Please try again.');
    } finally { setLoading(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setError(''); }
    catch { setError('Clipboard access is unavailable. Select the prompt above and copy it manually.'); }
  }

  return <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) { setCopied(false); setError(''); if (!prompt) void loadPrompt(); } }}>
    <DialogTrigger render={<Button variant={hero ? 'secondary' : agent ? 'ghost' : 'outline'} className={hero ? 'h-12 rounded-lg bg-[#f3f4f6] px-6 text-[#080d18]' : agent ? 'mt-7 h-auto w-fit rounded-none p-0 text-sm font-medium underline underline-offset-4' : 'mt-auto h-11 w-fit rounded-md border-[#d9dde3] px-5'} />}>
      {hero ? <ArrowUpRight className="size-4" /> : !agent ? <MessageSquare className="size-4" /> : null}
      {agent ? 'Set up your agent' : 'Copy the AI prompt'}
      {agent && !hero && <ArrowUpRight className="size-4" />}
    </DialogTrigger>
    <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-white p-6 text-[#080d18] sm:max-w-2xl sm:p-8">
      <div className="pr-6"><p className="mb-3 text-xs uppercase tracking-[.12em] text-[#727c89]">A conversation starter</p><DialogTitle className="text-2xl tracking-tight">{agent ? 'Set up your agent.' : 'Start planning your trip.'}</DialogTitle><DialogDescription className="mt-3 leading-6 text-[#626b76]">{agent ? 'Preview the setup prompt, then paste it into your coding agent.' : 'Here’s exactly what you’ll copy. Paste it into your favourite AI chat to start planning.'}</DialogDescription></div>
      <div className="rounded-lg border border-[#e3e5e9] bg-[#f8f9fa] p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium text-[#626b76]"><MessageSquare className="size-4" />You → {agent ? 'Your coding agent' : 'Your AI assistant'}</p>
        {loading ? <p role="status" className="py-8 text-sm text-[#626b76]">Preparing your prompt…</p> : prompt ? <textarea aria-label={agent ? 'Agent setup prompt' : 'AI trip prompt'} readOnly value={prompt} className="h-64 w-full resize-y rounded-md border border-[#e3e5e9] bg-white p-4 text-sm leading-7 outline-none focus-visible:ring-2 focus-visible:ring-[#89909a] sm:h-80" /> : null}
      </div>
      {error && <p role="status" className="text-sm text-[#626b76]">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#727c89]">{agent ? 'Install the skill. Let it handle the rest.' : 'Includes the complete trip format.'}</p>{!prompt && !loading ? <Button onClick={() => void loadPrompt()} variant="outline">Try again</Button> : <Button disabled={loading || !prompt} onClick={() => void copy()} className="h-11 rounded-md bg-[#080d18] px-5 text-white">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}<span aria-live="polite">{copied ? 'Copied!' : 'Copy prompt'}</span></Button>}</div>
    </DialogContent>
  </Dialog>;
}
