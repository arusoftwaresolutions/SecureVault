import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileUp, Lock, Unlock, X, Loader2, Link2, Shield, ClipboardPaste, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { decryptPackage, readShareLinkHash, parseVaultFile } from '../lib/crypto-utils';
import { parsePastedLink } from '../lib/share-link';
import { db } from '../lib/db';
import type { DecryptedPayload } from '../types/app';
import { cn } from '@/lib/utils';
import SecureKeyField from './SecureKeyField';

interface ReceiverFormProps {
  onBack?: () => void;
  onFound: (payload: DecryptedPayload) => void;
  initialPayload?: string;
}

type UnlockSource =
  | { kind: 'link'; payload: string; label: string }
  | { kind: 'vault'; payload: string; fileName: string };

const ReceiverForm: React.FC<ReceiverFormProps> = ({ onBack, onFound, initialPayload }) => {
  const [tab, setTab] = useState<'link' | 'vault' | 'email'>('link');
  const [secureKey, setSecureKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errors, setErrors] = useState<{ key?: boolean; link?: boolean; vault?: boolean; email?: boolean }>({});
  const [source, setSource] = useState<UnlockSource | null>(null);
  const [pastedInput, setPastedInput] = useState('');
  const [vaultFileName, setVaultFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPayload) {
      setSource({ kind: 'link', payload: initialPayload, label: 'Direct link' });
      return;
    }
    const payload = readShareLinkHash();
    if (payload) {
      setSource({ kind: 'link', payload, label: 'Direct link' });
      toast.info('Encrypted package detected in this link — enter the secure key to unlock.');
    }
    const onHashChange = () => {
      const current = readShareLinkHash();
      if (current) setSource({ kind: 'link', payload: current, label: 'Direct link' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [initialPayload]);

  const handlePaste = () => {
    const payload = parsePastedLink(pastedInput);
    if (!payload) {
      setErrors((prev) => ({ ...prev, link: true }));
      toast.error('No encrypted package found in that input — paste the direct share link or token.');
      return;
    }
    setSource({ kind: 'link', payload, label: 'Pasted link' });
    setErrors((prev) => ({ ...prev, link: false }));
    toast.success('Encrypted package loaded from the link — enter your secure key to unlock.');
  };

  const handleEmailUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = emailInput.trim();
    if (!clean || !clean.includes('@')) {
      setErrors((prev) => ({ ...prev, email: true }));
      toast.error('Please enter the email address the sender used.');
      return;
    }
    if (!secureKey || secureKey.length < 4) {
      setErrors((prev) => ({ ...prev, key: true }));
      toast.error('Please enter the secure key (at least 4 characters).');
      return;
    }
    setIsUnlocking(true);
    try {
      const result = await db.retrieveByEmail(clean);
      if (result.status !== 'found') {
        toast.error('No package found for these credentials.');
        return;
      }
      const payload = await decryptPackage(result.payload, secureKey);
      if (result.expiry === 'burn') {
        await db.removeItem(`msg_${clean.toLowerCase().trim()}`);
        toast.info('Package burned after reading — it is no longer available.');
      }
      onFound(payload);
    } catch {
      toast.error('No package found for these credentials.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secureKey || secureKey.length < 4) {
      setErrors((prev) => ({ ...prev, key: true }));
      toast.error('Please enter a secure key of at least 4 characters');
      return;
    }
    if (source) {
      setIsUnlocking(true);
      try {
        const payload = await decryptPackage(source.payload, secureKey);
        onFound(payload);
      } catch (error: any) {
        const msg = error?.message || 'Failed to unlock the package';
        if (/invalid key|decryption failed/i.test(msg)) toast.error('Wrong secure key — the package could not be unlocked.');
        else toast.error(msg);
      } finally {
        setIsUnlocking(false);
      }
      return;
    }
    toast.error('No package loaded. Paste a share link or upload a .vault file first.');
  };

  const handleVaultFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const pkg = await parseVaultFile(file);
      setSource({ kind: 'vault', payload: pkg.payload, fileName: file.name });
      setVaultFileName(file.name);
      setErrors((prev) => ({ ...prev, vault: false }));
      toast.success('Encrypted package loaded — enter your secure key to unlock.');
    } catch (error: any) {
      setSource(null);
      setVaultFileName('');
      setErrors((prev) => ({ ...prev, vault: true }));
      toast.error(error.message || 'This file could not be read as a valid .vault package');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleVaultFile(e.target.files?.[0]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleVaultFile(e.dataTransfer.files?.[0]);
  };

  const modeLabel = tab === 'email'
    ? 'Email Inbox'
    : source
      ? source.kind === 'vault'
        ? 'Uploaded File'
        : 'Direct Link'
      : 'Awaiting Package';

  return (
    <Card className="border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
      <div className="h-1.5 bg-emerald-600" />
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <CardTitle className="text-2xl">Retrieve Securely</CardTitle>
        </div>
        <CardDescription>Find a package by email, unlock a pasted share link, or upload an encrypted .vault file.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(val) => setTab(val as 'link' | 'vault' | 'email')}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="email" className="gap-2"><Mail className="w-4 h-4" />Email Inbox</TabsTrigger>
            <TabsTrigger value="link" className="gap-2"><Link2 className="w-4 h-4" />Link or Token</TabsTrigger>
            <TabsTrigger value="vault" className="gap-2"><FileUp className="w-4 h-4" />.vault File</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-0 space-y-4">
            <form onSubmit={handleEmailUnlock} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="receiver-email" className="text-sm font-semibold flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />Your Email Address
                </label>
                <Input
                  id="receiver-email"
                  type="email"
                  placeholder="the email the sender used for you"
                  className={cn('border-slate-200 rounded-xl py-5', errors.email && 'border-red-500 ring-red-100')}
                  value={emailInput}
                  onChange={(e) => { setEmailInput(e.target.value); if (e.target.value.includes('@')) setErrors((prev) => ({ ...prev, email: false })); }}
                />
                <p className="text-[10px] text-slate-400">Works across devices — packages are matched to this email in the cloud vault.</p>
              </div>

              <SecureKeyField id="email-key" value={secureKey} showKey={showKey} setShowKey={setShowKey} invalid={!!errors.key}
                onKeyChange={(v) => { setSecureKey(v); if (v.length >= 4) setErrors((prev) => ({ ...prev, key: false })); }} />

              <Button type="submit" disabled={isUnlocking}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 text-lg font-bold transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50">
                {isUnlocking ? (<><Loader2 className="w-5 h-5 animate-spin" />Verifying credentials...</>) : (<><Unlock className="w-5 h-5" />Unlock Package</>)}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="link" className="mt-0 space-y-4">
            {source && source.kind === 'link' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800 text-sm">
                <Link2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Encrypted package detected ({source.label})</p>
                  <p className="text-xs mt-0.5">The package is embedded in this link. Just enter the secure key below to unlock it.</p>
                </div>
              </div>
            )}

            {!source || source.kind !== 'link' ? (
              <div className="space-y-2">
                <label htmlFor="receiver-paste" className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardPaste className="w-3.5 h-3.5" />Paste a Share Link or Token
                </label>
                <Input
                  id="receiver-paste"
                  placeholder="Paste the direct link (...#v=...) or encrypted token here"
                  className={cn('border-slate-200 rounded-xl py-5', errors.link && 'border-red-500 ring-red-100')}
                  value={pastedInput}
                  onChange={(e) => { setPastedInput(e.target.value); if (e.target.value.trim()) setErrors((prev) => ({ ...prev, link: false })); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePaste(); } }}
                />
                <p className="text-[10px] text-slate-400">Supports full URLs, bare #v=... fragments, raw tokens, and JSON payloads.</p>
                <Button type="button" variant="outline" onClick={handlePaste}
                  className="w-full rounded-xl py-5 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <ClipboardPaste className="w-4 h-4" />Load Package from Link
                </Button>
              </div>
            ) : null}

            <SecureKeyField id="receiver-key" value={secureKey} showKey={showKey} setShowKey={setShowKey} invalid={!!errors.key}
              onKeyChange={(v) => { setSecureKey(v); if (v.length >= 4) setErrors((prev) => ({ ...prev, key: false })); }} />

            <Button onClick={handleUnlock} disabled={isUnlocking || !source || source.kind !== 'link'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 text-lg font-bold transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50">
              {isUnlocking ? (<><Loader2 className="w-5 h-5 animate-spin" />Unlocking...</>) : (<><Unlock className="w-5 h-5" />Unlock Package</>)}
            </Button>
          </TabsContent>

          <TabsContent value="vault" className="mt-0 space-y-4">
            <div onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              className={cn('border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all cursor-pointer group', dragOver && 'border-emerald-500 bg-emerald-50', errors.vault && 'border-red-300 bg-red-50/30')}>
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <FileUp className="w-6 h-6 text-slate-400 group-hover:text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-700">Click or drop your .vault file</p>
                <p className="text-xs text-slate-400">The encrypted package the sender downloaded (.vault)</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".vault,application/json" className="hidden" onChange={handleFileChange} />
            </div>
            {source?.kind === 'vault' && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 truncate max-w-[220px]">{vaultFileName}</p>
                    <p className="text-[10px] text-slate-500">Encrypted package loaded successfully</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => { setSource(null); setVaultFileName(''); }}
                  className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-full">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <SecureKeyField id="vault-key" value={secureKey} showKey={showKey} setShowKey={setShowKey} invalid={!!errors.key}
              onKeyChange={(v) => { setSecureKey(v); if (v.length >= 4) setErrors((prev) => ({ ...prev, key: false })); }} />
            <Button onClick={handleUnlock} disabled={isUnlocking || !source || source.kind !== 'vault'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 text-lg font-bold transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 disabled:opacity-50">
              {isUnlocking ? (<><Loader2 className="w-5 h-5 animate-spin" />Unlocking...</>) : (<><Unlock className="w-5 h-5" />Unlock Package</>)}
            </Button>
          </TabsContent>
        </Tabs>
        <div className="mt-6 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-emerald-600" />Decryption happens 100% locally in your browser.</span>
          <span className="font-mono text-emerald-700">{modeLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReceiverForm;
