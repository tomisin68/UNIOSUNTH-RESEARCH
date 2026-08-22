import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import LikertItem from '../components/LikertItem';
import { IPC_ITEMS, IPC_LABELS, IPC_SUBSCALES } from '../data/ipcItems';
import type { IPCResponse } from '../types';
import { useSession } from '../context/SessionContext';

const STEPS = ['Demographics', 'Workload', 'IPC Scale', 'Results'];

export default function IPCAssessment() {
  const navigate = useNavigate();
  const { session, setIPCResponses, hasParticipant } = useSession();
  const [responses, setResponses] = useState<IPCResponse>(session.ipcResponses);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!hasParticipant) navigate('/assess', { replace: true });
  }, [hasParticipant, navigate]);

  const answered = Object.keys(responses).length;
  const total = IPC_ITEMS.length;
  const allAnswered = answered === total;

  function handleChange(id: number, value: number) {
    setResponses(prev => ({ ...prev, [id]: value }));
    if (showError) setShowError(false);
  }

  function handleNext() {
    if (!allAnswered) { setShowError(true); return; }
    setIPCResponses(responses);
    navigate('/assess/results');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar step={3} total={4} labels={STEPS} />

      {/* Instruction banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-teal-800 text-sm mb-1">
          IPC Compliance Scale (CSPS)
        </h2>
        <p className="text-xs text-teal-700 leading-relaxed">
          How <strong>often</strong> do you perform each infection prevention practice in your
          current nursing work? Select the most accurate response per item.
        </p>
        <div className="flex gap-3 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          {Object.entries(IPC_LABELS).map(([k, v]) => (
            <span key={k} className="text-xs text-teal-600 whitespace-nowrap flex-shrink-0">
              <strong>{k}</strong>&nbsp;=&nbsp;{v}
            </span>
          ))}
        </div>
      </div>

      {/* Progress pill */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-medium">
          {answered} of {total} answered
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round((answered / total) * 100)}%</span>
        </div>
      </div>

      {/* Items by subscale */}
      {IPC_SUBSCALES.map(subscale => (
        <div key={subscale} className="mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
            {subscale}
          </h3>
          {IPC_ITEMS.filter(i => i.subscale === subscale).map(item => (
            <LikertItem
              key={item.id}
              id={item.id}
              text={item.text}
              labels={IPC_LABELS}
              value={responses[item.id]}
              onChange={handleChange}
              colorScheme="teal"
              reversed={item.reversed}
            />
          ))}
        </div>
      ))}

      {showError && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-4 text-sm text-red-600">
          Please answer all {total} items before continuing.
          {' '}({total - answered} remaining)
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <button
          onClick={() => navigate('/assess/workload')}
          className="flex-1 sm:flex-none border border-gray-300 text-gray-600 px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 sm:flex-none bg-teal-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-teal-700 active:bg-teal-800 transition-colors touch-manipulation"
        >
          View Results →
        </button>
      </div>
    </div>
  );
}
