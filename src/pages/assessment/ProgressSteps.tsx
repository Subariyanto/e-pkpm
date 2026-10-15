import { Check } from 'lucide-react';
import { STEPS } from './helpers';

export function ProgressSteps({ step, setStep, done }: { step: number; setStep: (n: number) => void; done: boolean[] }) {
  return (
    <div className="flex items-center justify-center mb-6 overflow-x-auto px-2 py-1">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center shrink-0">
          <button onClick={() => setStep(i)} className="flex flex-col items-center gap-1" title={label}>
            <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              done[i] ? 'bg-emerald-500 border-emerald-500 text-white' :
              i === step ? 'bg-teal-600 border-teal-600 text-white' :
              'bg-slate-200 border-slate-300 text-slate-500'
            }`}>
              {done[i] ? <Check size={18} /> : i + 1}
            </span>
            <span className={`text-[10px] max-w-[72px] text-center leading-tight hidden md:block ${i === step ? 'text-teal-700 font-bold' : 'text-slate-500'}`}>
              {label.split('—')[0].trim()}
            </span>
          </button>
          {i < STEPS.length - 1 && (
            <div className={`w-8 md:w-16 h-1 mx-1 rounded ${done[i] ? 'bg-emerald-400' : 'bg-slate-300'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
