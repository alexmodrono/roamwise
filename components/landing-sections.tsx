'use client';

import { LandingPromptDialog } from './landing-prompt-dialog';

import './fonts-editor.css';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Code2, Compass, Copy, FileText, MapPin, Route, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const VALIDATE_COMMAND = 'npx --yes --package=@roamwise/cli@0.1.0 roamwise validate trip.yaml --json';
const OPEN_COMMAND = 'npx --yes --package=@roamwise/cli@0.1.0 roamwise open trip.yaml';
const TERMINAL_DONE_STEP = 6;

function AgentTerminal({ editorial = false }: { editorial?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState([0, 0]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    const initial = setTimeout(update);
    query.addEventListener('change', update);
    return () => { clearTimeout(initial); query.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => setInView(entries.some(entry => entry.isIntersecting)), { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      const initial = setTimeout(() => {
        setStep(TERMINAL_DONE_STEP);
        setTyped([VALIDATE_COMMAND.length, OPEN_COMMAND.length]);
      });
      return () => clearTimeout(initial);
    }
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); });
    const typeCommand = async (command: string, index: number) => {
      for (let count = 1; count <= command.length; count++) {
        if (cancelled) return;
        setTyped(current => current.map((value, i) => (i === index ? count : value)));
        await wait(command.codePointAt(count - 1) === 32 ? 55 : 13 + ((count * 7) % 17));
      }
    };
    const run = async () => {
      while (!cancelled) {
        setStep(0);
        setTyped([0, 0]);
        await wait(800); if (cancelled) return;
        setStep(1); await wait(1500); if (cancelled) return;
        setStep(2); await wait(2300); if (cancelled) return;
        setStep(3); await typeCommand(VALIDATE_COMMAND, 0); if (cancelled) return;
        await wait(500); setStep(4); await wait(1500); if (cancelled) return;
        setStep(5); await typeCommand(OPEN_COMMAND, 1); if (cancelled) return;
        await wait(500); setStep(6); await wait(5200);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [inView, reducedMotion]);

  const reveal = reducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-1 duration-300';
  const cursor = <span aria-hidden="true" className="landing-terminal-cursor ml-0.5 inline-block h-[1.05em] w-[0.55em] translate-y-[0.16em] bg-[#f1f1e8]" />;
  return <figure ref={root} aria-label="A coding agent drafts trip.yaml and opens it with the Roamwise CLI." className={editorial ? 'min-h-[530px] overflow-hidden rounded-lg border border-[#2b3541] bg-[#0b1118] text-[#e9edf1] [font-family:var(--font-code)] [--terminal-muted:#9daaba] [--terminal-dim:#7e8c9d] [--terminal-label:#c7d0dc] [--terminal-accent:#edf0f5] [--terminal-success:#c7d0dc] [--terminal-indicator:#9daaba]' : 'overflow-hidden rounded-2xl bg-[#26392f] text-[#f1f1e8] shadow-[0_24px_70px_-30px_#1f2d18cc] [font-family:var(--font-code)]'}>
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-white/15 px-4 text-xs text-[var(--terminal-muted,#b5c3ac)]">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        <span className={`size-[0.65rem] rounded-full ${editorial ? "bg-[#586574]" : "bg-[#df6b52]"}`} />
        <span className={`size-[0.65rem] rounded-full ${editorial ? "bg-[#748293]" : "bg-[#e0b45c]"}`} />
        <span className="size-[0.65rem] rounded-full bg-[var(--terminal-indicator,#8ba774)]" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Code2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">local-agent / roamwise</span>
      </div>
    </div>
    <div className="grid gap-3 px-4 py-5 text-[12.5px] leading-relaxed sm:px-5">
      <div className="grid gap-0.5 text-[11px] text-[var(--terminal-dim,#8f9d87)]">
        <div className="text-[var(--terminal-label,#d9dfce)]">Coding agent</div>
        <div>workspace ~/seville-weekend</div>
      </div>
      <div className="flex gap-2.5 rounded-lg bg-white/10 px-3.5 py-2.5">
        <span aria-hidden="true" className="text-[var(--terminal-muted,#b5c3ac)]">›</span>
        <span>Plan a long weekend in Seville for two. Walkable, and keep the stays under €120.</span>
      </div>
      {step >= 1 && <div className={`flex gap-2.5 px-0.5 ${reveal}`}>
        <span aria-hidden="true" className="mt-[0.45rem] size-1.5 shrink-0 rounded-full bg-[var(--terminal-indicator,#8ba774)]" />
        <span>I’ll compare stays, draft <span className="text-[var(--terminal-accent,#e8b69d)]">trip.yaml</span>, then open it in Roamwise so you can explore the plan.</span>
      </div>}
      {step >= 2 && <div className={`grid gap-1 px-0.5 text-[11px] ${reveal}`}>
        <div className="text-[#f1f1e8]">Explored</div>
        {([['Search', 'stays near historic centre under €120'], ['Read', 'format.md'], ['Write', 'trip.yaml']] as const).map(([tool, detail]) => (
          <div key={tool} className="grid grid-cols-[0.8rem_minmax(0,1fr)] gap-x-1.5 [overflow-wrap:anywhere]">
            <span aria-hidden="true" className="text-[var(--terminal-dim,#8f9d87)]">└</span>
            <span><span className="text-[var(--terminal-success,#9dbd82)]">{tool}</span> {detail}</span>
          </div>
        ))}
      </div>}
      {step >= 3 && <div className={`grid gap-2 rounded-lg border border-white/15 bg-black/25 p-3 text-[11px] leading-relaxed ${reveal}`}>
        <div className="break-all"><span aria-hidden="true" className="text-[var(--terminal-indicator,#8ba774)]">$ </span>{VALIDATE_COMMAND.slice(0, typed[0])}{step === 3 && cursor}</div>
        {step >= 4 && <div className={`text-[var(--terminal-muted,#b5c3ac)] ${reveal}`}>✓ trip.yaml is valid — 3 days · 2 stays · 12 activities</div>}
      </div>}
      {step >= 5 && <div className={`grid gap-2 rounded-lg border border-white/15 bg-black/25 p-3 text-[11px] leading-relaxed ${reveal}`}>
        <div className="break-all"><span aria-hidden="true" className="text-[var(--terminal-indicator,#8ba774)]">$ </span>{OPEN_COMMAND.slice(0, typed[1])}{step === 5 && cursor}</div>
        {step >= 6 && <div className={`text-[var(--terminal-muted,#b5c3ac)] ${reveal}`}>Preview ready → <span className="text-[var(--terminal-success,#9dbd82)] underline underline-offset-2">http://localhost:8787/</span></div>}
        {step >= 6 && <div className={`text-[var(--terminal-dim,#8f9d87)] ${reveal}`}>Waiting while you explore — the file stays in sync.</div>}
      </div>}
    </div>
  </figure>;
}

export function LandingAgentSection({ id = "agents" }: { id?: string }) {
  return <section id={id} className="scroll-mt-8 border-t border-[#e3e5e9] py-16 text-[#080d18] sm:py-24">
    <div className="mb-10 flex items-center justify-between text-xs uppercase tracking-[.12em] text-[#727c89]"><span>For your coding agent</span><span>01 / A shared workspace</span></div>
    <div className="grid items-start gap-10 lg:grid-cols-[.85fr_1.15fr] lg:gap-20"><div><h2 className="text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl">The conversation.<br />The code.<br /><em className="font-normal" style={{ fontFamily: 'Georgia, serif' }}>The whole trip.</em></h2><p className="mt-6 max-w-md text-base leading-8 text-[#626b76]">Your agent does the research. Roamwise gives the plan a place to unfold. One portable file connects the conversation to a live, visual itinerary.</p><div className="mt-8 max-w-md divide-y divide-[#e3e5e9] border-y border-[#e3e5e9] text-sm">{['Runs through npx. No global install.', 'One preview, updated as you plan.', 'On-demand maps. Automatic idle shutdown.'].map((text,i)=><p key={text} className="flex gap-4 py-4"><span className="text-xs text-[#89909a]">0{i+1}</span>{text}</p>)}</div><LandingPromptDialog kind="agent" /></div><div><AgentTerminal editorial /><p className="mt-4 flex items-start gap-3 text-xs leading-6 text-[#727c89]"><span className="mt-2 size-1 shrink-0 rounded-full bg-[#89909a]" /><span>Illustrative agent session. The public npm release is being prepared; the setup guide includes the release-tarball workflow available today.</span></p></div></div>
  </section>;
}

export function LandingUploadSection() {
  const input = useRef<HTMLInputElement>(null);
  const [yaml, setYaml] = useState('');
  const [paste, setPaste] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function openYaml(text: string) {
    setBusy(true); setMessage('');
    try {
      const { validateTrip } = await import('@/packages/core/trip-schema');
      const result = validateTrip(text);
      if (!result.trip) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
      localStorage.setItem('roamwise-trip-v2', text);
      window.location.assign('/planner/');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not open your trip.'); }
    finally { setBusy(false); }
  }
  async function load(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage('Choose a YAML file smaller than 2 MiB.'); return; }
    try { await openYaml(await file.text()); } catch { setMessage('This file could not be read. Please try again.'); }
  }
  async function openDemo() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/trips/seville.trip.yaml');
      if (!response.ok) throw new Error('Could not load the demo. Please try again.');
      await openYaml(await response.text());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load the demo.'); }
    finally { setBusy(false); }
  }
  return <section id="try-it" className="scroll-mt-8 border-t border-[#e3e5e9] pb-20 pt-16 text-[#080d18] sm:pt-24">
    <div className="mb-9 flex flex-wrap items-end justify-between gap-6"><div><p className="mb-5 text-xs uppercase tracking-[.12em] text-[#727c89]">No terminal? No problem.</p><h2 className="text-4xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-5xl">Your next trip,<br /><em className="font-normal" style={{fontFamily:'Georgia, serif'}}>ready to explore.</em></h2></div><p className="max-w-sm text-base leading-8 text-[#626b76]">Generate a trip with any AI assistant, then bring the YAML here. Everything opens in your browser.</p></div>
    <div className="grid border border-[#e3e5e9] md:grid-cols-[.85fr_1.15fr]">
      <div className="flex flex-col border-b border-[#e3e5e9] p-6 sm:p-9 md:border-b-0 md:border-r"><span className="text-xs text-[#89909a]">01 — MAKE THE PLAN</span><FileText className="mb-6 mt-9 size-7" strokeWidth={1.3} /><h3 className="text-2xl font-medium tracking-tight">Start with your assistant.</h3><p className="mb-7 mt-3 max-w-sm text-sm leading-7 text-[#626b76]">Copy a prompt with the full Roamwise format. Tell your AI where you’re headed, and ask for a downloadable YAML file.</p><LandingPromptDialog kind="trip" /><div className="mt-5 flex flex-wrap gap-5 text-xs text-[#626b76]"><a href="/format.md" className="underline underline-offset-4">Format guide</a><a href="/trips/seville.trip.yaml" download className="underline underline-offset-4">Full Spain demo YAML</a><button disabled={busy} onClick={() => void openDemo()} className="underline underline-offset-4">Explore the Spain demo</button></div></div>
      <div className="bg-[#f8f9fa] p-6 sm:p-9"><span className="text-xs text-[#89909a]">02 — BRING IT TO LIFE</span><div onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault(); if (!busy) void load(event.dataTransfer.files[0]);}} className="mt-6 flex min-h-64 flex-col items-center justify-center border border-dashed border-[#c9ced6] bg-white p-6 text-center"><Upload className="size-7" strokeWidth={1.3} /><h3 className="mt-5 text-xl font-medium tracking-tight">Drop your trip here.</h3><p className="mt-2 text-xs text-[#727c89]">.yaml or .yml · Up to 2 MiB</p><input ref={input} type="file" accept=".yaml,.yml" aria-label="Choose trip YAML file" className="sr-only" onChange={event=>{void load(event.target.files?.[0]);event.target.value='';}} /><Button disabled={busy} onClick={()=>input.current?.click()} className="mt-6 h-11 rounded-md bg-[#080d18] px-6 text-white"><ArrowUpRight className="size-4" />{busy?'Opening trip…':'Choose a YAML file'}</Button></div><button onClick={()=>setPaste(value=>!value)} aria-expanded={paste} className="mt-4 text-xs font-medium underline underline-offset-4">{paste?'Hide YAML input':'Paste YAML instead'}</button>{paste && <div className="mt-4"><Textarea aria-label="Paste trip YAML" value={yaml} onChange={event=>setYaml(event.target.value)} placeholder="schema: roamwise/v2" className="min-h-48 rounded-md border-[#d9dde3] bg-white font-mono text-xs" /><Button disabled={busy||!yaml.trim()} onClick={()=>void openYaml(yaml)} className="mt-3 rounded-md bg-[#080d18] text-white">Open pasted trip <ArrowUpRight /></Button></div>}<p className="mt-5 text-[11px] leading-6 text-[#727c89]">Processed on this device. Opening a file replaces your saved trip. Maps and remote photos connect to their providers.</p></div>
    </div>
    {message && <p role="status" className="mt-4 whitespace-pre-wrap border border-[#e3e5e9] p-4 text-sm">{message}</p>}
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#727c89]"><span>No account needed. One portable file.</span><a href="/planner/" className="inline-flex items-center gap-2 text-[#080d18]">Or start from a blank plan <ArrowUpRight className="size-3.5" /></a></div>
  </section>;
}
