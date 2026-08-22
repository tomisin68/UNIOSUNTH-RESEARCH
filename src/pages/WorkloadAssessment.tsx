import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import LikertItem from '../components/LikertItem';
import { WORKLOAD_ITEMS, WORKLOAD_LABELS, WORKLOAD_SUBSCALES } from '../data/workloadItems';
import type { WorkloadResponse } from '../types';
import { useSession } from '../context/SessionContext';

const STEPS = ['Demographics', 'Workload', 'IPC Scale', 'Results'];

export default function WorkloadAssessment() {
  const navigate = useNavigate();
  const { session, setWorkloadResponses, hasParticipant } = useSession();
  const [responses, setResponses] = useState<WorkloadResponse>(session.workloadResponses);
  const [showError, setShowError] = useState(false);

  // The draft lives in memory only, so a reload lands here with no participant.
  useEffect(() => {
    if (!hasParticipant) navigate('/assess', { replace: true });
  }, [hasParticipant, navigate]);

  const answered = Object.keys(responses).length;
  const total = WORKLOAD_ITEMS.length;
  const allAnswered = answered === total;

  function handleChange(id: number, value: number) {
    setResponses(prev => ({ ...prev, [id]: value }));
    if (showError) setShowError(false);
  }

  function handleNext() {
    if (!allAnswered) { setShowError(true); return; }
    setWorkloadResponses(responses);
    navigate('/assess/ipc');
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar step={2} total={4} labels={STEPS} />

      {/* Instruction banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
        <h2 className="font-semibold text-primary-800 text-sm mb-1">Nursing Workload Scale</h2>
        <p className="text-xs text-primary-700 leading-relaxed">
          Rate how each statement applied to your work during your{' '}
          <strong>most recent completed shift</strong>. Select one response per item.
        </p>
        {/* Legend — horizontal scroll on mobile */}
        <div className="flex gap-3 mt-2 overflow-x-auto pb-1 scrollbar-hide">
          {Object.entries(WORKLOAD_LABELS).map(([k, v]) => (
            <span key={k} className="text-xs text-primary-600 whitespace-nowrap flex-shrink-0">
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
              className="h-full bg-primary-500 transition-all"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round((answered / total) * 100)}%</span>
        </div>
      </div>

      {/* Items by subscale */}
      {WORKLOAD_SUBSCALES.map(subscale => (
        <div key={subscale} className="mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
            {subscale}
          </h3>
          {WORKLOAD_ITEMS.filter(i => i.subscale === subscale).map(item => (
            <LikertItem
              key={item.id}
              id={item.id}
              text={item.text}
              labels={WORKLOAD_LABELS}
              value={responses[item.id]}
              onChange={handleChange}
              colorScheme="blue"
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
          onClick={() => navigate('/assess')}
          className="flex-1 sm:flex-none border border-gray-300 text-gray-600 px-5 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          className="flex-1 sm:flex-none bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 transition-colors touch-manipulation"
        >
          IPC Scale →
        </button>
      </div>
    </div>
  );
}
