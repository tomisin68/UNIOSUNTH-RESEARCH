import { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Eye, EyeOff, X, Loader2 } from 'lucide-react';
import { hasPIN, setPIN, verifyPIN, unlock } from '../utils/coordinator';
import { firebaseConfigured } from '../lib/firebase';

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export default function CoordinatorModal({ onSuccess, onClose }: Props) {
  // The PIN lives in the study database, so whether one exists is a lookup,
  // not a local check — the same PIN works on every device used for the study.
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    hasPIN()
      .then(exists => { if (active) setIsFirstTime(!exists); })
      .catch(() => { if (active) setError('Could not reach the study database.'); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isFirstTime) {
        if (pin.length < 4) { setError('PIN must be at least 4 digits'); return; }
        if (pin !== confirm) { setError('PINs do not match'); return; }
        await setPIN(pin);
      } else {
        const ok = await verifyPIN(pin);
        if (!ok) { setError('Incorrect PIN'); return; }
      }
      unlock();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify the PIN');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white w-full sm:w-80 sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary-600" />
            <h3 className="font-semibold text-gray-800 text-sm">
              {isFirstTime ? 'Set Coordinator PIN' : 'Coordinator Access'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 touch-manipulation">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {!firebaseConfigured ? (
          <div className="p-5">
            <p className="text-sm text-red-600">
              The study database is not configured, so coordinator access cannot be verified.
            </p>
          </div>
        ) : isFirstTime === null ? (
          <div className="p-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Checking study settings…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {isFirstTime && (
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-3">
                <p className="text-xs text-primary-700 leading-relaxed">
                  Create the PIN that only the <strong>research coordinator</strong> knows. It is
                  stored in the study database, so it applies to every device — and it can only be
                  set once.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {isFirstTime ? 'New Coordinator PIN' : 'Enter PIN'}
              </label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="e.g. 1234"
                  maxLength={8}
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 touch-manipulation"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {isFirstTime && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Confirm PIN
                </label>
                <input
                  type={show ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="Re-enter PIN"
                  maxLength={8}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                <Lock size={12} />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 touch-manipulation transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? 'Verifying…' : isFirstTime ? 'Set PIN & Unlock' : 'Unlock'}
            </button>

            {!isFirstTime && (
              <p className="text-center text-xs text-gray-400">
                Forgot the PIN? Ask your research supervisor.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
