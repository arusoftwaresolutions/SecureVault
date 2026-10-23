import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import SenderForm from './components/SenderForm';
import ReceiverForm from './components/ReceiverForm';
import MessageDisplay from './components/MessageDisplay';
import SecurityDocs from './components/SecurityDocs';
import { readShareLinkHash } from './lib/crypto-utils';
import type { DecryptedPayload, AppMode } from './types/app';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('idle');
  const [decryptedPayload, setDecryptedPayload] = useState<DecryptedPayload | null>(null);
  const [directPayload, setDirectPayload] = useState<string | null>(null);

  // Auto-detect direct share links (#v=<payload>): jump straight into
  // receive mode so the recipient only needs to enter the secure key.
  useEffect(() => {
    const payload = readShareLinkHash();
    if (payload) {
      setDirectPayload(payload);
      setMode('receive');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-white">
      <Navbar
        onHome={() => { setMode('idle'); setDecryptedPayload(null); }}
        onShare={() => setMode('send')}
        onCheck={() => setMode('receive')}
        onDocs={() => setMode('docs')}
        currentMode={mode}
      />

      <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
        <AnimatePresence mode="wait">
          {mode === 'idle' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-4xl mx-auto text-center space-y-8"
            >
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight">
                  Share Data <span className="text-blue-600">Securely</span>
                </h1>
                <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  End-to-end encrypted file sharing with zero-knowledge storage. 
                  Your data is encrypted in your browser before it ever leaves your device.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <button
                  onClick={() => setMode('send')}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  Share Securely
                </button>
                <button
                  onClick={() => setMode('receive')}
                  className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold rounded-xl border-2 border-slate-200 hover:border-blue-300 transition-all flex items-center gap-2 cursor-pointer"
                >
                  Check Message
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
                {[
                  { title: 'AES-256-GCM', desc: 'Military-grade encryption directly in your browser' },
                  { title: 'Zero-Knowledge', desc: 'We never see your data or your secure key' },
                  { title: 'Auto-Destruct', desc: 'Set expiration times for automatic deletion' },
                ].map((feature) => (
                  <div key={feature.title} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-600">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {mode === 'send' && (
            <motion.div
              key="send"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <SenderForm onBack={() => setMode('idle')} />
            </motion.div>
          )}

          {mode === 'receive' && (
            <motion.div
              key="receive"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.3 }}
              className="max-w-2xl mx-auto"
            >
              <ReceiverForm
                onBack={() => setMode('idle')}
                onFound={(payload) => {
                  setDecryptedPayload(payload);
                  setMode('display');
                }}
                initialPayload={directPayload ?? undefined}
              />
            </motion.div>
          )}

          {mode === 'display' && decryptedPayload && (
            <motion.div
              key="message"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto"
            >
              <MessageDisplay
                payload={decryptedPayload}
                onBack={() => setMode('receive')}
              />
            </motion.div>
          )}

          {mode === 'docs' && (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-4xl mx-auto"
            >
              <SecurityDocs onBack={() => setMode('idle')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
};

export default App;