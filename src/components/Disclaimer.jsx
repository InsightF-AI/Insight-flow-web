import { Info } from 'lucide-react';
import { DISCLAIMER } from '../api/mock/ai.js';

/** RF-16 / RN-05 — aviso legal obrigatório em toda saída de IA. */
export default function Disclaimer({ className = '' }) {
  return (
    <div className={`flex items-start gap-2 rounded-sm border border-tone-orange-bg bg-tone-orange-bg px-3 py-2 ${className}`}>
      <Info size={14} className="mt-0.5 shrink-0 text-warn" />
      <p className="text-xs text-warn">{DISCLAIMER}</p>
    </div>
  );
}
