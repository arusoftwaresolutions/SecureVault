import React from 'react';
import { Shield, Lock, Key, Server, Eye, RefreshCw, ArrowLeft, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

interface SecurityDocsProps {
  onBack: () => void;
}

const SecurityDocs: React.FC<SecurityDocsProps> = ({ onBack }) => {
  return (
    <div className="space-y-8 w-full">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-3xl font-bold text-slate-900">Security Architecture</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <Lock className="w-6 h-6" />
            <h2 className="text-xl font-bold">End-to-End Encryption</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            SecureVault uses industry-standard <strong>AES-256-GCM</strong> encryption. Your data is encrypted 
            directly in your browser before it ever leaves your device. We use the Web Crypto API, 
            the most secure way to handle cryptographic operations in modern browsers.
          </p>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              PBKDF2 Key Derivation
            </h3>
            <p className="text-sm text-slate-500">
              Your "Secure Key" isn't used directly. We derive a high-entropy 256-bit key using PBKDF2 
              with 100,000 iterations and a unique salt for every message.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <Server className="w-6 h-6" />
            <h2 className="text-xl font-bold">Zero-Knowledge Storage</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Because decryption happens on the client-side, our servers only see "garbage" data. 
            Even if our database were compromised, your information remains unreadable without 
            the original Secure Key.
          </p>
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-sm text-red-800">
              <strong>Crucial:</strong> We do not store your Secure Key. If you lose it, the data 
              is gone forever. There is no "Password Reset" for shared keys.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <Eye className="w-6 h-6" />
            <h2 className="text-xl font-bold">Privacy First</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            We don't track who you are. No accounts, no cookies, no persistent IDs. 
            The recipient email is used only as a temporary identifier to match the payload.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600">
            <RefreshCw className="w-6 h-6" />
            <h2 className="text-xl font-bold">Automatic Destruction</h2>
          </div>
          <p className="text-slate-600 leading-relaxed">
            All shared data is temporary. You can set an expiration time, after which the 
            encrypted payload is permanently deleted from our system.
          </p>
        </section>
      </div>

      <Card className="bg-slate-900 text-white border-none shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-400" />
            Security Checklist
          </CardTitle>
          <CardDescription className="text-slate-400">
            Follow these tips for maximum security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-slate-300">
            <li className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              Use a unique Secure Key for every transfer.
            </li>
            <li className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              Share the Secure Key via a different channel than the email (e.g., Signal or in-person).
            </li>
            <li className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              Use the "Burn after reading" option for highly sensitive credentials.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-4 pb-12">
        <Button onClick={onBack} size="lg" className="rounded-xl px-12">
          Got it, take me back
        </Button>
      </div>
    </div>
  );
};

export default SecurityDocs;