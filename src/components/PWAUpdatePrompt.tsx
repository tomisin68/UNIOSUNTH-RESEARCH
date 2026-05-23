import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export default function PWAUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 sm:left-auto sm:right-4 sm:w-80 z-50">
      <div className="bg-teal-700 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <div className="flex-shrink-0 bg-teal-600 rounded-xl p-2">
          <RefreshCw size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Update Available</p>
          <p className="text-teal-200 text-xs mt-0.5 leading-snug">
            A new version of the app is ready.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => updateServiceWorker(true)}
              className="bg-white text-teal-800 px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-teal-50 touch-manipulation"
            >
              Update now
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="border border-teal-500 text-teal-200 px-3 py-1.5 rounded-xl text-xs font-medium touch-manipulation"
            >
              Later
            </button>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="flex-shrink-0 text-teal-300 hover:text-white touch-manipulation">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
