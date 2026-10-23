import React from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';

interface SecureKeyFieldProps {
  id: string;
  value: string;
  showKey: boolean;
  setShowKey: (v: boolean | ((prev: boolean) => boolean)) => void;
  invalid: boolean;
  onKeyChange: (val: string) => void;
}

const SecureKeyField: React.FC<SecureKeyFieldProps> = ({ id, value, showKey, setShowKey, invalid, onKeyChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id} className={cn('text-sm font-semibold flex items-center gap-2', invalid && 'text-red-500')}>
      <KeyRound className="w-3.5 h-3.5" />
      Secure Key
    </Label>
    <div className="relative">
      <Input
        id={id}
        type={showKey ? 'text' : 'password'}
        placeholder="Enter the secure key from the sender"
        className={cn('border-slate-200 rounded-xl py-5 pr-12', invalid && 'border-red-500 ring-red-100')}
        value={value}
        onChange={(e) => onKeyChange(e.target.value)}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={showKey ? 'Hide secure key' : 'Show secure key'}
        onClick={() => setShowKey((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors"
      >
        {showKey ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
      </button>
    </div>
    <p className="text-[10px] text-slate-400">Decryption happens 100% locally — the key is never transmitted or stored.</p>
  </div>
);

export default SecureKeyField;