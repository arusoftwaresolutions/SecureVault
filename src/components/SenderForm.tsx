import React, { useRef, useState } from 'react';
import { ArrowLeft, Send, Shield, Info, Clock, Hash, FileUp, X, FileText, FileImage, Plus, AlertCircle, Quote, Link2, Download, Check, Copy, Cloud, CloudOff, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { encryptData, FileItem, base64ToBytes, buildShareLink, createVaultFile, decodeHashPayload } from '../lib/crypto-utils';
import { db } from '../lib/db';
import { cn } from '@/lib/utils';

const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25 MB (IndexedDB handles multi-MB payloads)

interface SenderFormProps {
  onBack: () => void;
}

const EXPIRY_MAP: Record<string, number | string> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  'burn': 'burn'
};

type SyncStatus = 'idle' | 'encrypting' | 'syncing' | 'cloud' | 'local' | 'error';

const SenderForm: React.FC<SenderFormProps> = ({ onBack }) => {
  const [textData, setTextData] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [hint, setHint] = useState('');
  const [email, setEmail] = useState('');
  const [secureKey, setSecureKey] = useState('');
  const [expiry, setExpiry] = useState('24h');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [errors, setErrors] = useState<{email?: boolean; key?: boolean; data?: boolean}>({});
  const [progress, setProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [shareLink, setShareLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [encryptedPayload, setEncryptedPayload] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const newSize = newFiles.reduce((acc, f) => acc + f.size, 0);
      if (totalSize + newSize > MAX_TOTAL_SIZE) {
        toast.error(`Total file size exceeds 25 MB limit`);
        return;
      }
      setFiles(prev => [...prev, ...newFiles]);
      setErrors(prev => ({ ...prev, data: false }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const newErrors: {email?: boolean; key?: boolean; data?: boolean} = {};
    if (!email || !email.includes('@')) newErrors.email = true;
    if (!secureKey || secureKey.length < 4) newErrors.key = true;

    const hasData = activeTab === 'text' ? textData.trim().length > 0 : files.length > 0;
    if (!hasData) newErrors.data = true;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix the errors before sending');
      return;
    }

    setIsSubmitting(true);
    setSyncStatus('encrypting');
    setProgress(5);

    try {
      const items: FileItem[] = [];

      if (activeTab === 'text') {
        items.push({
          type: 'text/plain',
          data: new TextEncoder().encode(textData)
        });
      } else {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const buffer = await file.arrayBuffer();
          items.push({
            name: file.name,
            type: file.type || 'application/octet-stream',
            data: new Uint8Array(buffer)
          });
          setProgress(10 + Math.round(((i + 1) / files.length) * 40));
        }
      }

      // Perform encryption locally
      setProgress(55);
      const encryptedBase64 = await encryptData(items, secureKey, hint);
      setProgress(70);

      const cleanEmail = email.toLowerCase().trim();
      const storageKey = `msg_${cleanEmail}`;
      const expiryValue = EXPIRY_MAP[expiry];

      // 1. Attempt storage upload; fall back to inline payload if unavailable
      const encryptedBytes = base64ToBytes(encryptedBase64);
      const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
      const storagePath = `${cleanEmail}/${Date.now()}.enc`;

      setSyncStatus('syncing');
      setProgress(80);

      let storedPath: string | null = null;
      try {
        storedPath = await db.uploadBlob(storagePath, blob);
      } catch (uploadError: any) {
        console.warn('[Vault] Blob upload threw; storing payload inline.', uploadError?.message || uploadError);
        storedPath = null;
      }

      // Always persist the inline encrypted payload so retrieval works
      // even when cloud storage download is unreachable.
      await db.setItem(storageKey, {
        payload: encryptedBase64,
        storagePath: storedPath || undefined,
        timestamp: Date.now(),
        expiry: expiryValue,
        isPackage: true
      });
      setProgress(95);

      // Determine sync status for the success screen.
      const health = await db.checkCloudHealth();
      setSyncStatus(health === 'cloud' ? 'cloud' : 'local');

      // Build the direct one-click share link (encrypted payload in URL hash).
      setEncryptedPayload(encryptedBase64);
      setShareLink(buildShareLink(encryptedBase64));
      setProgress(100);

      setIsSuccess(true);
      toast.success('Information shared securely!');
    } catch (error: any) {
      console.error(error);
      setSyncStatus('error');
      toast.error(error.message || 'Failed to encrypt and store data');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      window.prompt('Copy your share link:', shareLink);
    }
  };

  const handleDownloadVault = () => {
    try {
      const encryptedBase64 = decodeHashPayload(shareLink.split('#v=')[1] ?? '') ?? encryptedPayload;
      if (!encryptedBase64) {
        toast.error('Could not read encrypted payload');
        return;
      }
      const vaultBlob = createVaultFile(encryptedBase64);
      const url = URL.createObjectURL(vaultBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `secure-vault-${Date.now()}.vault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Encrypted .vault file downloaded');
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to download .vault file');
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-2 border-green-100 shadow-xl overflow-hidden">
        <div className="h-2 bg-green-500" />
        <CardHeader className="text-center pt-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Transfer Initialized</CardTitle>
          <CardDescription className="text-base pt-2">
            The data for <span className="font-semibold text-slate-900">{email}</span> has been encrypted and stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sync status badge */}
          <div className="flex items-center justify-center">
            {syncStatus === 'cloud' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
                <Cloud className="w-4 h-4" />
                Synced to Cloud Vault — available on any device
              </span>
            ) : syncStatus === 'local' ? (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                <HardDrive className="w-4 h-4" />
                Saved locally — cloud vault unreachable, use link or .vault file
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold">
                <CloudOff className="w-4 h-4" />
                Cloud sync failed — use link or .vault file
              </span>
            )}
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-600">
            Notify the recipient to visit SecureVault and use their email and the secure key you provided — or send them the direct link below.
          </div>

          {/* Direct share link */}
          {shareLink && (
            <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> Direct One-Click Share Link
              </p>
              <p className="text-[11px] text-slate-500">
                Recipient opens this link on any device, then unlocks it with your secure key. No account or cloud needed.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="font-mono text-xs border-slate-200 rounded-xl py-4 truncate"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="flex-shrink-0 rounded-xl gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {/* .vault download */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Encrypted .vault Backup
            </p>
            <p className="text-[11px] text-slate-500">
              Download the encrypted package and send it over any channel (email, WhatsApp, USB drive). The recipient uploads it into SecureVault and unlocks it with your key.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadVault}
              className="w-full rounded-xl py-5 gap-2 border-slate-200"
            >
              <Download className="w-4 h-4" />
              Download .vault File
            </Button>
          </div>

          <div className="flex flex-col gap-2 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Security Note</p>
            <p className="text-sm italic">"The key was never stored on our servers. Do not lose it."</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onBack} className="w-full bg-slate-900 hover:bg-slate-800 rounded-xl py-6">
            Share Another
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-2xl rounded-2xl overflow-hidden">
      <div className="h-1.5 bg-blue-600" />
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <CardTitle className="text-2xl">Share Securely</CardTitle>
        </div>
        <CardDescription>
          Your data is encrypted locally before being stored. Cross-device access is enabled via cloud vault, direct link, or .vault file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="text" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="text">Text Message</TabsTrigger>
              <TabsTrigger value="file">File Upload</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-2 mt-0">
              <Label htmlFor="data" className={cn("text-sm font-semibold flex items-center gap-2", errors.data && "text-red-500")}>
                Information to Share
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </Label>
              <Textarea
                id="data"
                placeholder="Paste text, code, or messages here..."
                className={cn(
                  "min-h-[150px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl",
                  errors.data && "border-red-500 ring-red-100"
                )}
                value={textData}
                onChange={(e) => {
                  setTextData(e.target.value);
                  if (e.target.value.trim()) setErrors(prev => ({...prev, data: false}));
                }}
              />
              {errors.data && <p className="text-xs text-red-500">Please provide content to share</p>}
            </TabsContent>

            <TabsContent value="file" className="space-y-2 mt-0">
              <Label className={cn("text-sm font-semibold flex items-center gap-2", errors.data && "text-red-500")}>
                Upload Files
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </Label>

              <div className="space-y-3">
                {files.length > 0 && (
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-medium text-slate-500">{files.length} file{files.length > 1 ? 's' : ''}</span>
                    <span className={`text-xs font-mono ${totalSize > MAX_TOTAL_SIZE * 0.8 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {(totalSize / 1024 / 1024).toFixed(2)} MB / 25 MB
                    </span>
                  </div>
                )}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center gap-4 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group",
                    errors.data && files.length === 0 && "border-red-300 bg-red-50/30"
                  )}
                >
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <FileUp className="w-6 h-6 text-slate-400 group-hover:text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-700">Click to select files</p>
                    <p className="text-xs text-slate-400">Supports PDF, Images, Source Code, etc. Up to 25 MB.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center">
                            {file.type.startsWith('image/') ? <FileImage className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-blue-500" />}
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{file.name}</p>
                            <p className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(idx)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 rounded-full"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl py-4 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add More Files
                    </Button>
                  </div>
                )}
              </div>
              {errors.data && files.length === 0 && <p className="text-xs text-red-500 text-center">Please upload at least one file</p>}
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="hint" className="text-sm font-semibold flex items-center gap-2">
              <Quote className="w-3.5 h-3.5 text-slate-400" />
              Optional Hint or Expression
            </Label>
            <Textarea
              id="hint"
              placeholder="Tell the receiver what this is (will be encrypted)..."
              className="min-h-[80px] resize-none border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
            <p className="text-[10px] text-slate-400">This message is only visible after decryption.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className={cn("text-sm font-semibold", errors.email && "text-red-500")}>Recipient's Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="recipient@example.com"
                className={cn("border-slate-200 rounded-xl py-5", errors.email && "border-red-500 ring-red-100")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (e.target.value.includes('@')) setErrors(prev => ({...prev, email: false}));
                }}
              />
              <p className="text-[10px] text-slate-400">Used as an identifier for the recipient.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key" className={cn("text-sm font-semibold flex items-center gap-2", errors.key && "text-red-500")}>
                Secure Key
                <Hash className="w-3.5 h-3.5 text-slate-400" />
              </Label>
              <Input
                id="key"
                type="password"
                placeholder="Create a shared secret"
                className={cn("border-slate-200 rounded-xl py-5", errors.key && "border-red-500 ring-red-100")}
                value={secureKey}
                onChange={(e) => {
                  setSecureKey(e.target.value);
                  if (e.target.value.length >= 4) setErrors(prev => ({...prev, key: false}));
                }}
              />
              <p className="text-[10px] text-slate-400">Min. 4 characters. Needed for decryption.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry" className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Auto-Delete After
            </Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="border-slate-200 rounded-xl py-5">
                <SelectValue placeholder="Select expiry" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="1h">1 Hour</SelectItem>
                <SelectItem value="24h">24 Hours</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
                <SelectItem value="burn">First Read (Burn after reading)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Live progress indicator */}
          {isSubmitting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500 flex items-center gap-2">
                  <Cloud className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                  {syncStatus === 'encrypting' ? 'Encrypting locally...' : 'Syncing to vault...'}
                </span>
                <span className="font-mono text-slate-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-100 [&>div]:bg-blue-600" />
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 text-blue-800 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <p>Your data is encrypted locally and stored in a secure cloud vault, accessible from any of your devices. You can also share a direct link or the encrypted .vault file as a backup.</p>
          </div>

          <Button
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 text-lg font-bold transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {syncStatus === 'encrypting' ? 'Encrypting...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Secure Transfer
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SenderForm;