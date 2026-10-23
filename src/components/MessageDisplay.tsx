import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Copy, Check, Trash2, ShieldCheck, Download, Code, FileText, Image as ImageIcon, File, ChevronRight, ChevronLeft, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './ui/card';
import { bytesToString, bytesToBlob } from '../lib/crypto-utils';
import type { DecryptedPayload, DecryptedItem } from '../types/app';
import { cn } from '@/lib/utils';

interface MessageDisplayProps {
  payload: DecryptedPayload;
  onBack: () => void;
}

const MessageDisplay: React.FC<MessageDisplayProps> = ({ payload, onBack }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = payload.items ?? [];
  const currentItem = items[activeIndex];

  const isImage = currentItem?.mimeType.startsWith('image/') ?? false;
  const isText = currentItem?.mimeType.startsWith('text/') || currentItem?.mimeType === 'application/json' || currentItem?.mimeType === 'application/javascript';

  const textContent = useMemo(() => {
    if (isText && currentItem) {
      try {
        return bytesToString(currentItem.data);
      } catch (e) {
        console.error('Decoding error:', e);
        return 'Unable to decode text content';
      }
    }
    return null;
  }, [currentItem, isText]);

  const imageUrl = useMemo(() => {
    if (isImage && currentItem) {
      const blob = bytesToBlob(currentItem.data, currentItem.mimeType);
      return URL.createObjectURL(blob);
    }
    return null;
  }, [currentItem, isImage]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Reset active index when items change
  useEffect(() => {
    if (activeIndex >= items.length) setActiveIndex(Math.max(0, items.length - 1));
  }, [items.length, activeIndex]);

  const handleCopy = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = (item: DecryptedItem) => {
    try {
      const blob = bytesToBlob(item.data, item.mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || `secure-file-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success('Download started');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const getFileIcon = (item: DecryptedItem) => {
    if (item.mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-600" />;
    if (item.mimeType.includes('code') || item.mimeType.includes('javascript')) return <Code className="w-5 h-5 text-blue-600" />;
    if (item.mimeType.startsWith('text/')) return <FileText className="w-5 h-5 text-blue-600" />;
    return <File className="w-5 h-5 text-blue-600" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="border-slate-200 shadow-2xl rounded-2xl overflow-hidden bg-white">
      <div className="h-1.5 bg-green-500" />
      <CardHeader className="border-b border-slate-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full -ml-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                Decrypted Content
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </CardTitle>
              <CardDescription>
                {items.length > 1 ? `${items.length} files retrieved from cloud vault.` : 'Secure message retrieved from cloud vault.'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200 mr-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full disabled:opacity-30"
                  onClick={() => setActiveIndex(prev => Math.max(0, prev - 1))}
                  disabled={activeIndex === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-bold px-2">{activeIndex + 1} / {items.length}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full disabled:opacity-30"
                  onClick={() => setActiveIndex(prev => Math.min(items.length - 1, prev + 1))}
                  disabled={activeIndex === items.length - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
            {isText && textContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(activeIndex, textContent)}
                className="rounded-full gap-2 border-slate-200"
              >
                {copiedIndex === activeIndex ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                {copiedIndex === activeIndex ? 'Copied' : 'Copy'}
              </Button>
            )}
            {currentItem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(currentItem)}
                className="rounded-full gap-2 border-slate-200"
              >
                <Download className="w-4 h-4" />
                Download
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Item List for multi-file quick navigation */}
      {items.length > 1 && (
        <div className="bg-slate-50/50 border-b border-slate-100 p-2 overflow-x-auto flex gap-2 no-scrollbar">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                activeIndex === idx
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
              )}
            >
              <div className="flex-shrink-0">
                {idx + 1}.
              </div>
              <span className="max-w-[120px] truncate">{item.fileName || 'Message'}</span>
            </button>
          ))}
        </div>
      )}

      <CardContent className="p-0 min-h-[300px] flex flex-col bg-slate-50/30">
        {/* Hint Section */}
        {payload.hint && (
          <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100 flex items-start gap-3">
            <div className="mt-1 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Sender&apos;s Note</p>
              <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{payload.hint}&rdquo;</p>
            </div>
          </div>
        )}

        <div className="flex-1 flex items-center justify-center p-4">
          {items.length === 0 ? (
            /* Empty state */
            <div className="p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto">
                <File className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900">No content found</p>
                <p className="text-sm text-slate-500 mt-1">The decrypted payload contains no items.</p>
              </div>
            </div>
          ) : isImage && imageUrl ? (
            <div className="p-4 w-full flex justify-center">
              <img src={imageUrl} alt="Decrypted" className="max-w-full max-h-[500px] rounded-lg shadow-sm border border-slate-200 object-contain" />
            </div>
          ) : isText ? (
            <pre className="w-full p-6 md:p-8 overflow-auto max-h-[500px] text-sm md:text-base leading-relaxed font-mono text-slate-800 whitespace-pre-wrap">
              {textContent}
            </pre>
          ) : (
            <div className="p-12 text-center space-y-4">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
                {getFileIcon(currentItem)}
              </div>
              <div>
                <p className="font-bold text-slate-900">{currentItem?.fileName || 'Binary File'}</p>
                <p className="text-sm text-slate-500">{currentItem?.mimeType || 'Unknown type'}</p>
                <p className="text-[10px] text-slate-400 mt-1">{currentItem?.data ? formatFileSize(currentItem.data.length) : '0 B'}</p>
              </div>
              <Button onClick={() => currentItem && handleDownload(currentItem)} className="rounded-xl">
                Download to View
              </Button>
            </div>
          )}
        </div>

        {currentItem?.fileName && (
          <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <File className="w-3 h-3" />
              {currentItem.fileName}
            </p>
            <p className="text-[10px] text-slate-400">{currentItem.mimeType}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-slate-50/80 border-t border-slate-100 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-slate-500 text-xs md:text-sm">
          <Cloud className="w-4 h-4 text-blue-400" />
          <span>Retrieved securely from Cloud Vault. Local session is temporary.</span>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            variant="ghost"
            className="flex-1 md:flex-none rounded-xl gap-2 text-slate-600"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            variant="destructive"
            className="flex-[2] md:flex-none rounded-xl gap-2 bg-red-500 hover:bg-red-600"
            onClick={onBack}
          >
            <Trash2 className="w-4 h-4" />
            Clear & Close
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default MessageDisplay;
