import React from 'react';
import { Github, Twitter, ShieldCheck } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-xl tracking-tight text-slate-900">
                SecureVault
              </span>
            </div>
            <p className="text-slate-500 max-w-xs leading-relaxed">
              Designed for extreme privacy. No tracking, no logs, no permanent storage.
              Your data belongs to you and your recipient.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="text-slate-400 hover:text-slate-600"><Github className="w-5 h-5" /></a>
              <a href="#" className="text-slate-400 hover:text-slate-600"><Twitter className="w-5 h-5" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#" className="hover:text-blue-600">Share Data</a></li>
              <li><a href="#" className="hover:text-blue-600">Retrieve Data</a></li>
              <li><a href="#" className="hover:text-blue-600">API Documentation</a></li>
              <li><a href="#" className="hover:text-blue-600">Self-Host</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Security</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="#" className="hover:text-blue-600">End-to-End Encryption</a></li>
              <li><a href="#" className="hover:text-blue-600">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-blue-600">Security Audit</a></li>
              <li><a href="#" className="hover:text-blue-600">Transparency Report</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">© 2024 SecureVault. Built for the privacy-first web.</p>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-slate-600">Status</a>
            <a href="#" className="hover:text-slate-600">Support</a>
            <a href="#" className="hover:text-slate-600">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;