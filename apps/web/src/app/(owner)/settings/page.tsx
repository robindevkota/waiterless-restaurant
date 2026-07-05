'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AiView { provider: 'gemini' | 'groq'; hasGeminiKey: boolean; hasGroqKey: boolean }
interface Settings {
  currency: string; vatRate: number; timezone: string;
  allowGuestNotes: boolean; autoCloseAfterMinutes: number;
  paymentQrUrl?: string; ai: AiView;
}

export default function SettingsPage() {
  const { accessToken, loading: authLoading } = useAuthStore();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    api.get<{ restaurant: { settings: Settings } }>('/restaurant/me', accessToken)
      .then((d) => setSettings(d.restaurant.settings))
      .catch(() => setMsg({ ok: false, text: 'Failed to load settings' }));
  }, [accessToken, authLoading]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        currency: settings.currency,
        vatRate: settings.vatRate,
        timezone: settings.timezone,
        allowGuestNotes: settings.allowGuestNotes,
        autoCloseAfterMinutes: settings.autoCloseAfterMinutes,
        paymentQrUrl: settings.paymentQrUrl ?? '',
        ai: {
          provider: settings.ai.provider,
          // keys are write-only: send only when the user typed something
          ...(geminiKey ? { geminiApiKey: geminiKey } : {}),
          ...(groqKey ? { groqApiKey: groqKey } : {}),
        },
      };
      const d = await api.patch<{ settings: Settings }>('/restaurant/me/settings', body, accessToken ?? undefined);
      setSettings(d.settings);
      setGeminiKey('');
      setGroqKey('');
      setMsg({ ok: true, text: 'Settings saved' });
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm text-gray-400 dark:text-zinc-400">Loading…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 dark:text-zinc-400 mb-6">Restaurant defaults and AI analyst configuration</p>

      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-4">General</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input id="currency" label="Currency" value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })} />
          <Input id="vatRate" label="VAT rate (%)" type="number" value={settings.vatRate}
            onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) })} />
          <Input id="timezone" label="Timezone" value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
          <Input id="autoClose" label="Auto-close sessions after (min)" type="number" value={settings.autoCloseAfterMinutes}
            onChange={(e) => setSettings({ ...settings, autoCloseAfterMinutes: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2.5 mt-4 text-sm text-gray-700 dark:text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={settings.allowGuestNotes}
            onChange={(e) => setSettings({ ...settings, allowGuestNotes: e.target.checked })}
            className="w-4 h-4 accent-orange-600" />
          Allow guests to add notes to orders
        </label>
      </div>

      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-zinc-200 mb-1">Payments</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-300 mb-4">
          Add your merchant payment QR (eSewa / Khalti / FonePay — the same one on your
          front-desk stand). Guests see it on their bill screen and can pay from the table,
          then tap &ldquo;I&rsquo;ve paid&rdquo; to notify the cashier. You still confirm
          each payment in your merchant app before settling.
        </p>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <Input id="paymentQr" label="Payment QR image URL" value={settings.paymentQrUrl ?? ''}
              placeholder="https://… (image of your merchant QR)"
              onChange={(e) => setSettings({ ...settings, paymentQrUrl: e.target.value })} />
            <p className="text-xs text-gray-400 dark:text-zinc-400 mt-2">Leave blank to hide the QR from the bill screen.</p>
          </div>
          {settings.paymentQrUrl?.trim() && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.paymentQrUrl} alt="Payment QR preview"
              className="w-24 h-24 rounded-lg border border-gray-200 dark:border-zinc-800 object-contain bg-white" />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#131318] border dark:border-zinc-800 border-gray-200 dark:border-zinc-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-semibold text-gray-800 dark:text-zinc-200">AI Business Analyst</h2>
          <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">⭐ Pro</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-300 mb-5">
          Bring your own free API key — get one from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-orange-600 underline">Google AI Studio</a>{' '}
          or <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 underline">Groq Console</a>.
          Keys are stored encrypted server-side and never shown again.
        </p>

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Preferred provider</p>
          <div className="flex gap-3">
            {(['groq', 'gemini'] as const).map((p) => (
              <label key={p} className={`flex-1 border rounded-xl px-4 py-3 cursor-pointer text-sm transition ${settings.ai.provider === p ? 'ring-1' : 'border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/60'}`}
                style={settings.ai.provider === p ? { borderColor: 'var(--brand, #ea580c)', background: 'color-mix(in srgb, var(--brand, #ea580c) 8%, transparent)', ['--tw-ring-color' as string]: 'color-mix(in srgb, var(--brand, #ea580c) 30%, transparent)' } : undefined}>
                <input type="radio" name="provider" className="sr-only" checked={settings.ai.provider === p}
                  onChange={() => setSettings({ ...settings, ai: { ...settings.ai, provider: p } })} />
                <span className="font-medium text-gray-900 dark:text-zinc-100 capitalize">{p}</span>
                <span className="block text-xs text-gray-400 dark:text-zinc-400 mt-0.5">
                  {p === 'groq' ? 'Llama 3.3 70B · fast free tier' : 'Gemini 2.0 Flash · Google free tier'}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-zinc-400 mt-2">If your preferred provider is over quota, the other one is tried automatically.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input id="groqKey" label={`Groq API key ${settings.ai.hasGroqKey ? '· configured ✓' : ''}`}
            type="password" value={groqKey} placeholder={settings.ai.hasGroqKey ? '•••••••• (leave blank to keep)' : 'gsk_…'}
            onChange={(e) => setGroqKey(e.target.value)} autoComplete="off" />
          <Input id="geminiKey" label={`Gemini API key ${settings.ai.hasGeminiKey ? '· configured ✓' : ''}`}
            type="password" value={geminiKey} placeholder={settings.ai.hasGeminiKey ? '•••••••• (leave blank to keep)' : 'AIza…'}
            onChange={(e) => setGeminiKey(e.target.value)} autoComplete="off" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={save} loading={saving} size="lg">Save settings</Button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
