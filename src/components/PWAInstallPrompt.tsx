import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem('pwa-dismissed') === '1'
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
    else dismiss();
  }

  function dismiss() {
    sessionStorage.setItem('pwa-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in">
      <div className="bg-primary-800 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <div className="flex-shrink-0 bg-primary-600 rounded-xl p-2">
          <Download size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install App</p>
          <p className="text-primary-200 text-xs mt-0.5 leading-snug">
            Add to your home screen for offline use and faster access.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="bg-white text-primary-800 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-primary-50 touch-manipulation"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              className="border border-primary-600 text-primary-200 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-primary-700 touch-manipulation"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="flex-shrink-0 text-primary-300 hover:text-white touch-manipulation">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
