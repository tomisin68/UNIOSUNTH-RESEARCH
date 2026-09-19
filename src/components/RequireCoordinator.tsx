import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { hasPIN, unlock, verifyPIN } from '../utils/coordinator';
import { useUnlocked } from '../hooks/useUnlocked';
import { firebaseConfigured } from '../lib/firebase';

// ── Coordinator-only route gate ───────────────────────────────────────────
// Wraps a page so its contents are never mounted until the coordinator PIN has
// been entered in this tab. Unlike the modal used on the Data page, this gate
// never offers first-run PIN creation: the PIN is seeded once for the study, so
// a page that offered to set one would let the first visitor claim it.
//
// This is a UI gate over pseudonymised data, not authentication. The Firestore
// rules still allow anonymous reads, so it keeps ward staff and casual visitors
// out of the coordinator views — it does not stop someone who goes to the
// database directly. See the note in utils/coordinator.ts.

interface Props {
  title: string;
  description: string;
  children: React.ReactNode;
}

export default function RequireCoordinator({ title, description, children }: Props) {
  const unlocked = useUnlocked();
  const [pinExists, setPinExists] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (unlocked || !firebaseConfigured) return;
    let active = true;
    hasPIN()
      .then(exists => { if (active) setPinExists(exists); })
      .catch(() => { if (active) setPinExists(false); });
    return () => { active = false; };
  }, [unlocked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setChecking(true);
    try {
      if (await verifyPIN(pin)) {
        unlock();
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    } catch {
      setError('Could not reach the study database.');
    } finally {
      setChecking(false);
    }
  }

  if (unlocked) return <>{children}</>;

  if (!firebaseConfigured) {
    return (
      <div className="max-w-sm mx-auto text-center py-16">
        <ShieldAlert size={40} className="mx-auto text-red-300 mb-3" />
        <h3 className="text-gray-600 font-medium">Study database not configured</h3>
        <p className="text-sm text-gray-400 mt-1">
          Coordinator access cannot be verified without the database.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto py-10 sm:py-16">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-primary-800 text-white px-5 py-4 flex items-center gap-2.5">
          <ShieldCheck size={20} className="flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm leading-tight">{title}</h2>
            <p className="text-primary-200 text-xs mt-0.5">Coordinator access only</p>
          </div>
        </div>

        <div className="p-5">
          <p className="text-xs text-gray-500 leading-relaxed mb-4">{description}</p>

          {pinExists === false ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800 leading-relaxed">
                No coordinator PIN has been set for this study yet. Ask the research
                supervisor to set one before these pages can be opened.
              </p>
            </div>
          ) : pinExists === null ? (
            <div className="py-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Checking study settings…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="coordinator-pin" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Enter coordinator PIN
                </label>
                <div className="relative">
                  <input
                    id="coordinator-pin"
                    type={show ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                    placeholder="••••"
                    maxLength={8}
                    autoFocus
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-bold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-primary-400 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    aria-label={show ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 touch-manipulation"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                  <Lock size={12} />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={checking || !pin}
                className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 touch-manipulation transition-colors flex items-center justify-center gap-2"
              >
                {checking && <Loader2 size={14} className="animate-spin" />}
                {checking ? 'Verifying…' : 'Unlock'}
              </button>

              <p className="text-center text-xs text-gray-400">
                The PIN unlocks this tab only and clears when the tab is closed.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
