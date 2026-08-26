import React, { useState } from 'react';

interface MetricResults {
  trappedCash: number;
  fundingGapDays: number;
  efficiencyIndex: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  indexColor: string;
}

export default function LiquiditySuite() {
  // Financial State Variables (Calibrated for Australian Mid-Market)
  const [revenue, setRevenue] = useState<number>(12000000);
  const [dso, setDso] = useState<number>(45);
  const [dpo, setDpo] = useState<number>(30);
  const [inventoryDays, setInventoryDays] = useState<number>(25);

  // Form State
  const [execName, setExecName] = useState('');
  const [execEmail, setExecEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Core Mathematical Framework
  const calculateMetrics = (): MetricResults => {
    const dailyRevenue = revenue / 365;
    const trappedCash = Math.max(0, dailyRevenue * dso);
    const fundingGapDays = dso - dpo;

    const cashConversionCycle = (dso + inventoryDays) - dpo;
    let efficiencyIndex: 'OPTIMAL' | 'WARNING' | 'CRITICAL' = 'OPTIMAL';
    let indexColor = '#D4AF37'; // Obsidian Gold

    if (cashConversionCycle > 40 || fundingGapDays > 10) {
      efficiencyIndex = 'CRITICAL';
      indexColor = '#EF4444'; // Corporate Red
    } else if (cashConversionCycle > 15 || fundingGapDays > 0) {
      efficiencyIndex = 'WARNING';
      indexColor = '#F59E0B'; // Amber
    }

    return { trappedCash, fundingGapDays, efficiencyIndex, indexColor };
  };

  const metrics = calculateMetrics();

  const handleAuditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (execName && execEmail && companyName) {
      setIsSubmitted(true);
      // Backend hook for your tracking agent goes here
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1115] text-slate-100 font-sans p-6 md:p-12 flex flex-col items-center">
      {/* Premium Institutional Header */}
      <div className="w-full max-w-5xl text-center mb-12">
        <span className="text-[#D4AF37] tracking-[0.2em] text-xs font-bold uppercase">Obsidian Treasury Console</span>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-2 text-white">
          Working Capital & Cash Liquidity Suite
        </h1>
        <p className="text-slate-400 mt-4 max-w-2xl mx-auto text-sm md:text-base">
          Audit your operational conversion cycle, pinpoint ledger liquidity friction points, and identify cash availability traps immediately.
        </p>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Executive Controls */}
        <div className="lg:col-span-1 bg-[#161920] border border-slate-800 rounded-xl p-6 shadow-2xl space-y-6">
          <h2 className="text-lg font-bold text-white tracking-wide border-b border-slate-800 pb-3">Operational Inputs</h2>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Annual Revenue (AUD)</label>
            <input
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(Number(e.target.value))}
              className="w-full bg-[#1C212C] border border-slate-700 rounded-lg py-2.5 px-4 text-white font-mono focus:outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Days Sales Outstanding (DSO)</label>
            <input
              type="range"
              min="10"
              max="120"
              value={dso}
              onChange={(e) => setDso(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>10 Days</span>
              <span className="text-[#D4AF37] font-bold">{dso} Days</span>
              <span>120 Days</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Days Payable Outstanding (DPO)</label>
            <input
              type="range"
              min="10"
              max="120"
              value={dpo}
              onChange={(e) => setDpo(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>10 Days</span>
              <span className="text-[#D4AF37] font-bold">{dpo} Days</span>
              <span>120 Days</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Days Inventory Outstanding (DIO)</label>
            <input
              type="range"
              min="0"
              max="90"
              value={inventoryDays}
              onChange={(e) => setInventoryDays(Number(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>0 Days</span>
              <span className="text-[#D4AF37] font-bold">{inventoryDays} Days</span>
              <span>90 Days</span>
            </div>
          </div>
        </div>

        {/* Right Panel: Analytics & Strategic Intercept Layer */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#161920] border-l-4 border-[#D4AF37] rounded-xl p-6 shadow-xl">
              <span className="text-xs tracking-wider text-slate-400 uppercase font-semibold">Trapped Ledger Capital</span>
              <div className="text-3xl font-black text-white font-mono mt-2">
                ${metrics.trappedCash.toLocaleString('en-AU', { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Liquid value tied up in outstanding receivables based on your current collection timeline.
              </p>
            </div>

            <div
              className="bg-[#161920] border-l-4 rounded-xl p-6 shadow-xl"
              style={{ borderColor: metrics.indexColor }}
            >
              <span className="text-xs tracking-wider text-slate-400 uppercase font-semibold">Operational Liquidity Gap</span>
              <div className="text-3xl font-black font-mono mt-2" style={{ color: metrics.indexColor }}>
                {metrics.fundingGapDays > 0 ? `+${metrics.fundingGapDays}` : metrics.fundingGapDays} Days
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {metrics.fundingGapDays > 0
                  ? 'CRITICAL: You are currently acting as an interest-free bank line for your clients.'
                  : 'OPTIMAL: Your supplier schedules are successfully buffering customer payment float.'}
              </p>
            </div>
          </div>

          {/* Interactive Conversion Box - "Book a Treasury Audit" Form */}
          <div className="bg-[#161920] border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-[#d4af3715] to-transparent w-1/2 h-full pointer-events-none" />

            <div className="relative z-10">
              <span className="bg-[#d4af371a] text-[#D4AF37] text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full uppercase">
                Premium Optimization Asset
              </span>
              <h3 className="text-xl font-bold text-white mt-4">Secure a Structured Treasury Audit</h3>
              <p className="text-slate-400 text-sm mt-2 max-w-xl">
                Your parameters indicate a {metrics.efficiencyIndex.toLowerCase()} cash conversion metric. Request a 1-on-1 operational breakdown to unlock trapped working capital reserves.
              </p>

              {!isSubmitted ? (
                <form onSubmit={handleAuditSubmit} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Executive Name"
                    value={execName}
                    onChange={(e) => setExecName(e.target.value)}
                    className="w-full bg-[#1C212C] border border-slate-700 rounded-lg py-2 px-4 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Corporate Email"
                    value={execEmail}
                    onChange={(e) => setExecEmail(e.target.value)}
                    className="w-full bg-[#1C212C] border border-slate-700 rounded-lg py-2 px-4 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Company Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-[#1C212C] border border-slate-700 rounded-lg py-2 px-4 text-sm text-white md:col-span-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#B89025] to-[#D4AF37] hover:from-[#D4AF37] hover:to-[#F3CD59] text-[#0F1115] font-bold text-sm tracking-wide py-2.5 px-6 rounded-lg md:col-span-2 shadow-lg shadow-[#d4af3720] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Initiate Private Portfolio Audit
                  </button>
                </form>
              ) : (
                <div className="mt-6 p-4 bg-[#d4af3710] border border-[#D4AF37] rounded-lg text-center">
                  <p className="text-[#D4AF37] font-bold text-sm">Audit Request Transmitted Successfully.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Our lead treasury officer will review your working capital structure profile within 1 business day.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
