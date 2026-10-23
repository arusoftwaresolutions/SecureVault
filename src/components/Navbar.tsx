import React, { useState } from 'react';
import { Lock, Menu, X, Send, Eye, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AppMode } from '../types/app';

interface NavbarProps {
  onHome: () => void;
  onShare: () => void;
  onCheck: () => void;
  onDocs: () => void;
  currentMode: AppMode;
}

const Navbar: React.FC<NavbarProps> = ({ onHome, onShare, onCheck, onDocs, currentMode }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Share Securely', action: onShare, icon: Send, active: currentMode === 'send' },
    { label: 'Check Message', action: onCheck, icon: Eye, active: currentMode === 'receive' },
  ];

  const handleAction = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div 
          onClick={onHome}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="bg-blue-600 p-1.5 rounded-lg group-hover:rotate-12 transition-transform">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">
            Secure<span className="text-blue-600">Vault</span>
          </span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.label}
              onClick={link.action}
              className={cn(
                "text-sm font-medium transition-colors hover:text-blue-600 flex items-center gap-2 cursor-pointer",
                link.active ? "text-blue-600" : "text-slate-600"
              )}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </button>
          ))}
          
          <div className="h-6 w-[1px] bg-slate-200" />
          
          <button 
            onClick={onDocs}
            className={cn(
              "px-4 py-2 text-sm font-semibold border rounded-full transition-all cursor-pointer flex items-center gap-2",
              currentMode === 'docs' 
                ? "bg-blue-600 text-white border-blue-600" 
                : "text-blue-600 border-blue-600 hover:bg-blue-50"
            )}
          >
            <BookOpen className="w-4 h-4" />
            Security Docs
          </button>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="flex flex-col p-4 space-y-4">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleAction(link.action)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-left font-medium transition-colors cursor-pointer",
                    link.active ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <link.icon className="w-5 h-5" />
                  {link.label}
                </button>
              ))}
              <div className="pt-2">
                <button 
                  onClick={() => handleAction(onDocs)}
                  className={cn(
                    "w-full px-4 py-3 text-center font-semibold border rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2",
                    currentMode === 'docs'
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-blue-600 border-blue-600 hover:bg-blue-50"
                  )}
                >
                  <BookOpen className="w-5 h-5" />
                  Security Docs
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;