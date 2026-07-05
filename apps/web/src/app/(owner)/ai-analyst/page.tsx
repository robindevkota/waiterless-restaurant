'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { AnalystChat } from '@/components/AnalystChat';
import { fmtMoney } from '@/components/charts';
import { Bot, Sparkles, Download, TrendingUp, AlertTriangle, Lightbulb, Star, Puzzle, Tractor, Bone } from 'lucide-react';

interface Insight { type: 'win' | 'warning' | 'opportunity'; title: string; detail: string; metric?: string }
interface Action { title: string; detail: string; expectedImpact: string; effort: 'low' | 'medium' | 'high' }
interface ReportContent {
  healthScore: number;
  healthLabel: string;
  executiveSummary: string;
  insights: Insight[];
  menuEngineering: { stars: string[]; puzzles: string[]; plowhorses: string[]; dogs: string[]; note: string };
  actions: Action[];
  forecast: { nextWeekRevenue: number; confidence: string; note: string };
}
interface Report { _id: string; provider: string; model: string; content: ReportContent; createdAt: string }

const INSIGHT_STYLE: Record<Insight['type'], { icon: React.ReactNode; label: string; chip: string; ring: string }> = {
  win:         { icon: <TrendingUp size={12} />,    label: 'Win',         chip: 'text-green-800 bg-green-100 dark:text-green-400 dark:bg-green-500/15',  ring: 'border-green-200 dark:border-green-500/25' },
  warning:     { icon: <AlertTriangle size={12} />, label: 'Watch',       chip: 'text-amber-800 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15',  ring: 'border-amber-200 dark:border-amber-500/25' },
  opportunity: { icon: <Lightbulb size={12} />,     label: 'Opportunity', chip: 'text-blue-800 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/15',    ring: 'border-blue-200 dark:border-blue-500/25' },
};

const EFFORT_CLS: Record<Action['effort'], string> = {
  low: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/25',
  medium: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/25',
  high: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/25',
};

const GEN_STEPS = [
  'Reading 30 days of sales…',
  'Scoring every menu item…',
  'Finding your peak hours…',
  'Comparing week over week…',
  'Writing your report…',
];

const HISTORY_PER_PAGE = 6;

function scoreColor(score: number) {
  return score >= 75 ? '#22c55e' : score >= 55 ? '#f59e0b' : score >= 35 ? '#fb923c' : '#ef4444';
}

/** Animated ring dial — sweeps from 0 to score on mount/report change. */
function HealthDial({ score, label, size = 132 }: { score: number; label: string; size?: number }) {
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    setSweep(0);
    const t = setTimeout(() => setSweep(score), 80);
    return () => clearTimeout(t);
  }, [score]);
  const r = size * 0.36, c = 2 * Math.PI * r, mid = size / 2;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Business health ${score} of 100`}>
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
        <circle
          cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(sweep / 100) * c} ${c}`} transform={`rotate(-90 ${mid} ${mid})`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)' }}
        />
        <text x={mid} y={mid + 2} textAnchor="middle" fontSize={size * 0.26} fontWeight="800" fill="#ffffff">{score}</text>
        <text x={mid} y={mid + size * 0.16} textAnchor="middle" fontSize={size * 0.085} fill="rgba(255,255,255,0.55)">/ 100</text>
      </svg>
      <span className="mt-1 text-sm font-semibold px-3 py-1 rounded-full" style={{ background: `${color}26`, color }}>
        {label}
      </span>
    </div>
  );
}

function MiniRing({ score }: { score: number }) {
  const r = 13, c = 2 * Math.PI * r;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
      <circle cx="17" cy="17" r={r} fill="none" strokeWidth="3.5" className="stroke-[#eceae5] dark:stroke-zinc-700" />
      <circle cx="17" cy="17" r={r} fill="none" stroke={scoreColor(score)} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 17 17)" />
      <text x="17" y="21" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-gray-700 dark:fill-zinc-100">{score}</text>
    </svg>
  );
}

function GeneratingCard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % GEN_STEPS.length), 1300);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="bg-[#14141f] text-white rounded-3xl p-12 text-center overflow-hidden relative">
      <div className="relative inline-flex items-center justify-center mb-6">
        <span className="absolute w-20 h-20 rounded-full animate-ping opacity-20" style={{ background: 'var(--brand, #ea580c)' }} />
        <span className="w-16 h-16 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--brand, #ea580c)' }}><Bot size={30} /></span>
      </div>
      <h2 className="text-xl font-bold">Your analyst is working</h2>
      <p className="text-gray-400 dark:text-zinc-400 mt-2 text-sm h-5 transition-all" key={step}>{GEN_STEPS[step]}</p>
      <div className="mt-6 mx-auto max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-1/3 rounded-full animate-[shimmer_1.4s_ease-in-out_infinite]"
          style={{ background: 'var(--brand, #ea580c)' }} />
      </div>
      <style>{`@keyframes shimmer { 0% { margin-left: -35%; } 100% { margin-left: 105%; } }`}</style>
    </div>
  );
}

const QUADRANTS = [
  { key: 'stars' as const,      title: 'Stars',      hint: 'Keep promoting',      icon: <Star size={14} className="text-green-600 dark:text-green-400" />,    cls: 'bg-green-50/70 border-green-200 dark:bg-green-500/[0.07] dark:border-green-500/25' },
  { key: 'puzzles' as const,    title: 'Puzzles',    hint: 'Market these harder', icon: <Puzzle size={14} className="text-blue-600 dark:text-blue-400" />,    cls: 'bg-blue-50/70 border-blue-200 dark:bg-blue-500/[0.07] dark:border-blue-500/25' },
  { key: 'plowhorses' as const, title: 'Plowhorses', hint: 'Reprice or upsell',   icon: <Tractor size={14} className="text-amber-600 dark:text-amber-400" />, cls: 'bg-amber-50/70 border-amber-200 dark:bg-amber-500/[0.07] dark:border-amber-500/25' },
  { key: 'dogs' as const,       title: 'Dogs',       hint: 'Rework or drop',      icon: <Bone size={14} className="text-red-500 dark:text-red-400" />,        cls: 'bg-red-50/60 border-red-200 dark:bg-red-500/[0.07] dark:border-red-500/25' },
];

export default function AiAnalystPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const brand = useBrandingStore((s) => s.branding.primaryColor) || '#E85D04';
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const load = useCallback(() => {
    if (!accessToken) return;
    api.get<{ reports: Report[] }>('/ai/reports', accessToken).then((d) => {
      setReports(d.reports);
      setSelected((cur) => cur ?? d.reports[0] ?? null);
    }).catch(() => {});
  }, [accessToken]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const d = await api.post<{ report: Report }>('/ai/reports', {}, accessToken ?? undefined);
      setSelected(d.report);
      setReports((r) => [d.report, ...r]);
      setHistoryPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  // Print → user saves as PDF. Temporarily force light theme so the PDF is
  // always the light version, then restore.
  function downloadPdf() {
    const { dark, toggle } = useThemeStore.getState();
    if (dark) toggle();
    setTimeout(() => {
      window.print(); // blocks until the dialog closes
      if (dark) toggle();
    }, 60);
  }

  const c = selected?.content;
  const historyPages = Math.ceil(reports.length / HISTORY_PER_PAGE);
  const historySlice = reports.slice((historyPage - 1) * HISTORY_PER_PAGE, historyPage * HISTORY_PER_PAGE);

  return (
    <div>
      {/* Print-only letterhead + print overrides */}
      <div className="hidden print:block mb-6 pb-4" style={{ borderBottom: '2px solid #111' }}>
        <p className="text-2xl font-bold text-black">AI Business Report</p>
        <p className="text-sm text-gray-600 mt-1">
          Generated {selected ? new Date(selected.createdAt).toLocaleString() : ''} · last 30 days · {selected?.provider} · powered by Waiterless
        </p>
      </div>
      <style>{`@media print {
        .print-hero, .print-forecast { background: #fff !important; color: #111 !important; border: 1px solid #d1d5db !important; box-shadow: none !important; }
        .print-hero p, .print-hero span, .print-forecast p, .print-forecast span { color: #111 !important; }
        .print-hero svg text { fill: #111 !important; }
        .print-card { break-inside: avoid; }
      }`}</style>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap print:hidden">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-gray-900 dark:text-zinc-100">AI Business Analyst</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">Your last 30 days, analysed like a consultant would — in seconds</p>
        </div>
        <div className="flex gap-2">
          {c && (
            <Button onClick={downloadPdf} variant="secondary" size="lg" title="Opens your browser's print dialog — choose 'Save as PDF'">
              <Download size={16} /> Download PDF
            </Button>
          )}
          <Button onClick={generate} loading={generating} size="lg" className="shadow-sm">
            {generating ? 'Analysing…' : <><Sparkles size={16} /> Generate new report</>}
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border dark:border-zinc-800 border-red-200 rounded-xl px-4 py-3 mb-6">
          {error}{error.includes('API key') && <> — <Link href="/settings" className="underline font-medium">open Settings</Link></>}
        </div>
      )}

      {/* Conversational analyst */}
      {accessToken && <div className="mb-6"><AnalystChat token={accessToken} /></div>}

      {generating && <div className="mb-6"><GeneratingCard /></div>}

      {!c && !generating && (
        <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-3xl p-14 text-center shadow-sm">
          <div className="flex justify-center mb-4"><span className="w-16 h-16 rounded-2xl flex items-center justify-center text-white" style={{ background: 'var(--brand, #ea580c)' }}><Bot size={32} /></span></div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">Meet your analyst</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-300 mt-2 max-w-md mx-auto leading-relaxed">
            One click reads your last 30 days of sales and returns a health score, menu
            engineering picks and concrete actions — like hiring a consultant, minus the invoice.
          </p>
        </div>
      )}

      {c && !generating && (
        <div className="grid xl:grid-cols-[1fr_250px] gap-6 items-start print:block">
          <div className="space-y-6 min-w-0">
            {/* Hero */}
            <div
              className="print-hero print-card rounded-3xl p-7 sm:p-8 text-white shadow-lg overflow-hidden relative"
              style={{ background: `linear-gradient(135deg, #14141f 55%, color-mix(in srgb, ${brand} 45%, #14141f))` }}
            >
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <HealthDial score={c.healthScore} label={c.healthLabel} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-400 dark:text-zinc-400 mb-3">
                    <span className="bg-white/10 rounded-full px-2.5 py-1">{new Date(selected!.createdAt).toLocaleString()}</span>
                    <span className="bg-white/10 rounded-full px-2.5 py-1">{selected!.provider} · {selected!.model}</span>
                    <span className="bg-white/10 rounded-full px-2.5 py-1">last 30 days</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-400 mb-2">Executive summary</p>
                  <p className="text-[15px] sm:text-base leading-relaxed text-gray-100">{c.executiveSummary}</p>
                </div>
              </div>
            </div>

            {/* Insights */}
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-3">What the data says</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {c.insights.map((ins, i) => {
                  const s = INSIGHT_STYLE[ins.type] ?? INSIGHT_STYLE.opportunity;
                  return (
                    <div key={i} className={`rounded-2xl border bg-white dark:bg-[#131318] p-4 shadow-sm hover:shadow transition ${s.ring}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${s.chip}`}>
                          {s.icon} {s.label}
                        </span>
                        {ins.metric && <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 tabular-nums bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">{ins.metric}</span>}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{ins.title}</p>
                      <p className="text-sm text-gray-600 dark:text-zinc-300 mt-1 leading-snug">{ins.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Menu engineering quadrant */}
            <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-3xl p-6 shadow-sm">
              <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
                <h2 className="font-semibold text-gray-800 dark:text-zinc-200">Menu engineering</h2>
                <p className="text-[11px] text-gray-400 dark:text-zinc-400">popularity → · revenue ↑</p>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-300 mb-4">{c.menuEngineering.note}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {QUADRANTS.map((q) => (
                  <div key={q.key} className={`rounded-2xl border p-4 ${q.cls}`}>
                    <div className="flex items-baseline justify-between mb-2.5">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-zinc-100 text-sm">{q.icon} {q.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-300">{q.hint}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.menuEngineering[q.key].length
                        ? c.menuEngineering[q.key].map((item) => (
                            <span key={item} className="text-xs bg-white/80 dark:bg-zinc-900/60 border dark:border-zinc-800 border-black/5 text-gray-800 dark:text-zinc-200 rounded-full px-2.5 py-1 font-medium">{item}</span>
                          ))
                        : <span className="text-xs text-gray-400 dark:text-zinc-400">None identified</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-3xl p-6 shadow-sm">
              <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">Do this next</h2>
              <ol className="space-y-3">
                {c.actions.map((a, i) => (
                  <li key={i} className="flex gap-4 rounded-2xl border dark:border-zinc-800 border-gray-100 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 p-4">
                    <div className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0" style={{ background: brand }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{a.title}</p>
                        <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${EFFORT_CLS[a.effort] ?? EFFORT_CLS.medium}`}>
                          {a.effort} effort
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-zinc-300 mt-1 leading-snug">{a.detail}</p>
                      <p className="text-xs font-semibold text-green-700 mt-1.5">↑ {a.expectedImpact}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Forecast */}
            <div
              className="print-forecast print-card rounded-3xl p-6 sm:p-7 text-white flex flex-wrap items-center justify-between gap-4 shadow-lg"
              style={{ background: `linear-gradient(120deg, ${brand}, color-mix(in srgb, ${brand} 55%, #14141f))` }}
            >
              <div>
                <p className="text-sm text-white/70">Projected revenue · next 7 days</p>
                <p className="text-4xl font-extrabold mt-1 tracking-tight">{fmtMoney(c.forecast.nextWeekRevenue)}</p>
                <p className="text-xs text-white/70 mt-2 max-w-md leading-relaxed">{c.forecast.note}</p>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide bg-white/15 rounded-full px-3.5 py-2">
                {c.forecast.confidence} confidence
              </span>
            </div>

            <p className="text-xs text-gray-400 dark:text-zinc-400 text-center pb-2">
              AI-generated analysis — a decision aid, not financial advice. Verify numbers before big moves.
            </p>
          </div>

          {/* History rail */}
          <aside className="print:hidden bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200/80 dark:border-white/[0.07] rounded-2xl xl:sticky xl:top-32 shadow-sm overflow-hidden">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 px-4 pt-4 pb-2">Report history</h3>
            <div className="px-2 pb-1">
              {historySlice.map((r) => (
                <button
                  key={r._id}
                  onClick={() => setSelected(r)}
                  className={`w-full flex items-center gap-3 text-left px-2.5 py-2.5 rounded-xl text-sm transition ${selected?._id === r._id ? 'ring-1' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}
                  style={selected?._id === r._id ? {
                    // brand tint over the card surface — readable in both themes
                    background: `color-mix(in srgb, ${brand} 14%, transparent)`,
                    ['--tw-ring-color' as string]: `color-mix(in srgb, ${brand} 35%, transparent)`,
                  } : undefined}
                >
                  <MiniRing score={r.content.healthScore} />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-800 dark:text-zinc-200 truncate">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      <span className="font-normal text-gray-400 dark:text-zinc-400 ml-1.5 text-xs">
                        {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-400 dark:text-zinc-400 truncate">{r.content.healthLabel} · {r.provider}</span>
                  </span>
                </button>
              ))}
            </div>
            <Pagination page={historyPage} pages={historyPages} onChange={setHistoryPage} />
          </aside>
        </div>
      )}
    </div>
  );
}
