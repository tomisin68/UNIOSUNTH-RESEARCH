import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import type { Demographics } from '../types';
import { saveSession, getSession, generateNurseCode } from '../utils/storage';

const WARDS = [
  'Male Medical Ward', 'Female Medical Ward', 'General Ward A', 'General Ward B',
  'Cardiology Unit', 'Endocrinology Unit', 'Gastroenterology Unit', 'Neurology Unit',
  'Respiratory Unit', 'Other Medical Ward',
];

const STEPS = ['Demographics', 'Workload', 'IPC Scale', 'Results'];

export default function Demographics() {
  const navigate = useNavigate();
  const saved = getSession()?.demographics ?? {};

  const [form, setForm] = useState<Partial<Demographics>>({
    // Reuse saved code if resuming, otherwise generate a new one
    nurseCode: (saved as Partial<Demographics>).nurseCode || generateNurseCode(),
    ward: '',
    shift: undefined,
    qualification: undefined,
    yearsExperience: '',
    patientLoad: '',
    ...(saved as Partial<Demographics>),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function regenerateCode() {
    setForm(f => ({ ...f, nurseCode: generateNurseCode() }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.ward) e.ward = 'Required';
    if (!form.shift) e.shift = 'Required';
    if (!form.qualification) e.qualification = 'Required';
    if (!form.yearsExperience?.trim()) e.yearsExperience = 'Required';
    if (!form.patientLoad?.trim()) e.patientLoad = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    saveSession({ demographics: form as Demographics, workloadResponses: {}, ipcResponses: {}, step: 2 });
    navigate('/assess/workload');
  }

  const inputClass = (key: string) =>
    `w-full border rounded-xl px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors ${
      errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
    }`;

  function RadioGroup<T extends string>({
    label,
    field,
    options,
  }: {
    label: string;
    field: keyof Demographics;
    options: T[];
  }) {
    return (
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2">{label}</label>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm(f => ({ ...f, [field]: opt }))}
              className={`px-3 py-2.5 sm:py-2 text-sm sm:text-xs rounded-xl border font-medium transition-colors touch-manipulation ${
                form[field] === opt
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:border-primary-400 active:bg-primary-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ProgressBar step={1} total={4} labels={STEPS} />

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">
          Participant Information
        </h2>
        <p className="text-xs text-gray-500 mb-4 sm:mb-5">
          A unique anonymous code has been generated for this participant.
        </p>

        <div className="space-y-4 sm:space-y-5">

          {/* Auto-generated nurse code — read only */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Nurse Code <span className="text-gray-400 font-normal">(auto-generated)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 flex items-center">
                <span className="font-mono font-bold text-primary-800 text-base tracking-widest flex-1">
                  {form.nurseCode}
                </span>
              </div>
              <button
                type="button"
                onClick={regenerateCode}
                className="flex-shrink-0 border border-gray-300 text-gray-500 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
                title="Generate a new code"
              >
                <RefreshCw size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Note this code — it identifies this nurse's record in the study database.
            </p>
          </div>

          {/* Ward */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ward</label>
            <select
              value={form.ward ?? ''}
              onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
              className={inputClass('ward')}
            >
              <option value="">Select ward...</option>
              {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            {errors.ward && <p className="text-xs text-red-500 mt-1">{errors.ward}</p>}
          </div>

          <RadioGroup<'Morning' | 'Afternoon' | 'Night'>
            label="Current Shift"
            field="shift"
            options={['Morning', 'Afternoon', 'Night']}
          />

          <RadioGroup<'RN' | 'BNSc' | 'RN+BNSc' | 'MSc' | 'PhD'>
            label="Highest Nursing Qualification"
            field="qualification"
            options={['RN', 'BNSc', 'RN+BNSc', 'MSc', 'PhD']}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Years of Experience
              </label>
              <input
                type="number"
                min="0"
                value={form.yearsExperience ?? ''}
                onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))}
                placeholder="e.g. 5"
                className={inputClass('yearsExperience')}
              />
              {errors.yearsExperience && (
                <p className="text-xs text-red-500 mt-1">{errors.yearsExperience}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Patients This Shift
              </label>
              <input
                type="number"
                min="0"
                value={form.patientLoad ?? ''}
                onChange={e => setForm(f => ({ ...f, patientLoad: e.target.value }))}
                placeholder="e.g. 8"
                className={inputClass('patientLoad')}
              />
              {errors.patientLoad && (
                <p className="text-xs text-red-500 mt-1">{errors.patientLoad}</p>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleNext}
          className="mt-6 w-full sm:w-auto sm:float-right bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 transition-colors touch-manipulation"
        >
          Continue to Workload Scale →
        </button>
      </div>
    </div>
  );
}
