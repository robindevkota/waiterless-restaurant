'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useBrandingStore } from '@/stores/brandingStore';
import { Bot, SendHorizonal } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  'What should I promote this weekend?',
  'Which dish earns me the most per plate?',
  'Why did revenue change last week?',
  'What is about to run out of stock?',
];

export function AnalystChat({ token }: { token: string }) {
  const brand = useBrandingStore((s) => s.branding.primaryColor) || '#E85D04';
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || thinking) return;
    setError('');
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setThinking(true);
    try {
      const d = await api.post<{ answer: string }>('/ai/chat', { messages: next.slice(-10) }, token);
      setMessages([...next, { role: 'assistant', content: d.answer }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The analyst is unavailable right now.');
      setMessages(messages); // roll back the question so the user can retry
      setInput(q);
    } finally {
      setThinking(false);
    }
  }

  return (
    <div className="bg-white dark:bg-[#131318] border border-black/[0.06] dark:border-white/[0.07] rounded-2xl shadow-sm overflow-hidden print:hidden">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: brand }}>
          <Bot size={17} />
        </span>
        <div>
          <p className="font-semibold text-gray-900 dark:text-zinc-100 leading-tight">Ask your analyst</p>
          <p className="text-[11px] text-gray-400 dark:text-zinc-400">Answers from your live sales & inventory data</p>
        </div>
      </div>

      {/* Conversation */}
      {(messages.length > 0 || thinking) && (
        <div className="px-5 pb-2 max-h-80 overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'text-white rounded-br-md'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 rounded-bl-md'
                }`}
                style={m.role === 'user' ? { background: brand } : undefined}
              >
                {m.content}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5" aria-label="Analyst is thinking">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Suggestions (fresh conversation only) */}
      {messages.length === 0 && !thinking && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="text-xs rounded-full border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 px-3 py-1.5 hover:border-transparent hover:text-white transition"
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = brand; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = ''; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="px-5 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="flex items-center gap-2 border-t border-gray-100 dark:border-zinc-800 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about your restaurant…"
          maxLength={1000}
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          aria-label="Send"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition active:scale-95"
          style={{ background: brand }}
        >
          <SendHorizonal size={16} />
        </button>
      </form>
    </div>
  );
}
