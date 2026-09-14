// frontend/src/pages/Home.jsx
import { useState } from 'react';
import { API_BASE } from '../config';

export default function Home({ setMode, setSessionId, setCustomerScreen }) {
  const [loading, setLoading] = useState(false);

  const handleStartShopping = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/sessions`, { method: 'POST' });
      const data = await response.json();
      setSessionId(data.sessionId);
      if (setCustomerScreen) setCustomerScreen('scanner');
      setMode('customer');
    } catch (error) {
      alert(`Error connecting to backend server at ${API_BASE}!`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col bg-[#f8fafc]">
      {/* Hero Section */}
      <section className="relative bg-[#0b132b] text-white pt-20 pb-36 md:pb-52 px-4 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-950/80 border border-blue-800/60 text-[#60a5fa] text-xs font-bold uppercase tracking-widest">
            Unified Retail Architecture
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
            FlashCart - Unified Shopping
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 font-normal max-w-2xl mx-auto leading-relaxed">
            Shop across multiple stores. One cart. One checkout. One receipt.
          </p>
        </div>

        {/* Decorative Blue Diagonal Lightning Wave Divider */}
        <svg 
          className="absolute bottom-0 left-0 w-full h-40 md:h-56 pointer-events-none"
          viewBox="0 0 1200 300" 
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="rgb(37, 99, 235)" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <path 
            d="M 0,80 Q 300,0 600,80 T 1200,80 L 1200,300 L 0,300 Z" 
            fill="url(#waveGradient)"
          />
        </svg>
      </section>

      {/* Action Buttons & Features Section */}
      <section className="max-w-4xl mx-auto w-full px-4 -mt-10 sm:-mt-14 relative z-20 pb-16 space-y-10 text-center">
        {/* Two Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto">
          <button
            onClick={handleStartShopping}
            disabled={loading}
            className="w-full sm:w-auto flex-1 bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-4 px-8 rounded-md shadow-sm text-sm transition cursor-pointer disabled:opacity-50 text-center"
          >
            {loading ? 'Starting Session...' : 'Start Shopping'}
          </button>

          <button
            onClick={() => {
              document.location.hash = 'cashier';
              setMode('cashier');
            }}
            className="w-full sm:w-auto flex-1 bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-[#eff6ff] font-bold py-4 px-8 rounded-md shadow-sm text-sm transition cursor-pointer text-center"
          >
            Cashier Desk
          </button>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left max-w-3xl mx-auto pt-2">
          <div className="bg-white border border-[#e2e8f0] rounded-md p-6 shadow-xs">
            <h3 className="text-lg font-bold text-[#0f172a] mb-2 tracking-tight">For Customers</h3>
            <p className="text-sm text-[#475569] leading-relaxed">
              Scan product tags across clothing, electronics, food, and jewelry showrooms on your device and pay in seconds.
            </p>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-md p-6 shadow-xs">
            <h3 className="text-lg font-bold text-[#0f172a] mb-2 tracking-tight">For Cashiers</h3>
            <p className="text-sm text-[#475569] leading-relaxed">
              Audit customer bags via Session ID, verify multi-tax GST calculations, and authorize gate clearance.
            </p>
          </div>
        </div>

        <p className="text-xs text-[#94a3b8]">
          Supports high-speed camera scanning for retail 1D & 2D barcodes with itemized GST breakdown.
        </p>
      </section>
    </div>
  );
}
