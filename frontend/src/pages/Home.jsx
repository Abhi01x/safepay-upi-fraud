import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../utils/api';
import BottomNav from '../components/BottomNav';
import TransactionCard from '../components/TransactionCard';

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [simLoading, setSimLoading] = useState('');
  const userName = localStorage.getItem('userName') || 'User';
  const userId = localStorage.getItem('userId');

  const reload = () => {
    api.getUser(userId).then(setUser).catch((err) => {
      // User not found in DB — stale session, redirect to login
      localStorage.clear();
      navigate('/login');
    });
    api.getTransactions(userId).then(setTransactions).catch(() => {});
  };

  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    reload();
  }, [userId, navigate]);

  const handleSimulate = async (scenario) => {
    setSimLoading(scenario);
    try {
      const data = await api.simulate(parseInt(userId), scenario);
      navigate('/send', { state: { prefill: data } });
    } catch { alert('Simulation failed'); }
    setSimLoading('');
  };

  return (
    <div className="min-h-screen bg-dark-bg pb-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-[120px] -translate-y-1/2" />

      {/* Header */}
      <div className="px-6 pt-14 pb-3 flex items-center justify-between relative z-10">
        <div>
          <p className="text-text-muted text-xs font-medium">Welcome back</p>
          <h1 className="text-white text-xl font-bold mt-0.5">{userName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
            user?.model_trained ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${user?.model_trained ? 'bg-success' : 'bg-primary animate-pulse'}`} />
            {user?.model_trained ? 'AI Active' : `${user?.txn_count || 0}/15`}
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="rounded-card p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(124,111,255,0.15) 0%, rgba(91,78,212,0.1) 100%)', border: '1px solid rgba(124,111,255,0.2)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-10 translate-x-10 blur-2xl" />
          <p className="text-text-secondary text-xs font-medium mb-1">Total Balance</p>
          <h2 className="text-white text-[32px] font-extrabold tracking-tight mb-3">
            ₹ 84,230<span className="text-base text-text-secondary">.00</span>
          </h2>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 w-fit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#7C6FFF"><path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/></svg>
            <span className="text-white/80 text-[10px] font-medium">IsolationForest AI Protection</span>
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <div className="px-6 mb-5 relative z-10">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Scan QR', icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4zm-6-6h4v4h-4v-4z"/></svg>), path: '/send', state: { openScanner: true }, gradient: 'from-success to-emerald-400' },
            { label: 'Send Money', icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7"/></svg>), path: '/send', gradient: 'from-primary to-purple-500' },
            { label: 'Profile', icon: (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>), path: '/profile', gradient: 'from-blue-500 to-cyan-400' },
          ].map((action, i) => (
            <motion.button key={action.label} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 * i }}
              whileTap={{ scale: 0.92 }} onClick={() => navigate(action.path, action.state ? { state: action.state } : undefined)} className="flex flex-col items-center">
              <div className={`bg-gradient-to-br ${action.gradient} rounded-2xl flex items-center justify-center text-white mb-2 shadow-lg`} style={{ width: 52, height: 52 }}>
                {action.icon}
              </div>
              <span className="text-[10px] text-text-secondary font-medium">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* DEMO PANEL — The hackathon killer */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-dark-card border border-primary/20 rounded-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🎯</span>
            <h3 className="text-white text-sm font-bold">Live Demo</h3>
          </div>
          <p className="text-text-muted text-[11px] mb-4">Tap to simulate a real transaction with pre-filled biometric data</p>

          <div className="grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleSimulate('normal')} disabled={!!simLoading}
              className="bg-success/10 border border-success/25 rounded-2xl py-3.5 px-3 flex flex-col items-center relative overflow-hidden">
              {simLoading === 'normal' && <div className="absolute inset-0 bg-success/10 animate-pulse" />}
              <div className="w-9 h-9 bg-success/20 rounded-xl flex items-center justify-center mb-2">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#00D68F" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              </div>
              <span className="text-success text-xs font-bold">Normal User</span>
              <span className="text-text-muted text-[9px] mt-0.5">Natural behavior → Allow</span>
            </motion.button>

            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleSimulate('fraud')} disabled={!!simLoading}
              className="bg-danger/10 border border-danger/25 rounded-2xl py-3.5 px-3 flex flex-col items-center relative overflow-hidden">
              {simLoading === 'fraud' && <div className="absolute inset-0 bg-danger/10 animate-pulse" />}
              <div className="w-9 h-9 bg-danger/20 rounded-xl flex items-center justify-center mb-2">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#FF4757" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </div>
              <span className="text-danger text-xs font-bold">Fraud Attack</span>
              <span className="text-text-muted text-[9px] mt-0.5">Bot behavior → Block</span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* How it works — for judges */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-dark-card border border-dark-border rounded-2xl p-4">
          <h3 className="text-white text-xs font-bold mb-3">How It Works</h3>
          <div className="space-y-3">
            {[
              { step: '1', title: 'Silent Collection', desc: 'Captures typing speed, mouse patterns, session duration while you pay', color: 'text-primary', bg: 'bg-primary/15' },
              { step: '2', title: '4-Layer Risk Scoring', desc: 'Device + Network + Behavioral + Transaction signals weighted', color: 'text-warning', bg: 'bg-warning/15' },
              { step: '3', title: 'IsolationForest AI', desc: 'Per-user anomaly detection trained on your last 15 transactions', color: 'text-success', bg: 'bg-success/15' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <span className={`text-[11px] font-bold ${s.color}`}>{s.step}</span>
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{s.title}</p>
                  <p className="text-text-muted text-[10px] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Transactions */}
      <div className="px-6 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-semibold">Recent Transactions</h3>
          <button onClick={() => navigate('/dashboard')} className="text-primary text-xs font-medium">Analytics</button>
        </div>
        <div className="bg-dark-card border border-dark-border rounded-card p-4">
          {transactions.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-6">No transactions yet</p>
          ) : transactions.slice(0, 4).map((txn) => <TransactionCard key={txn.id} txn={txn} />)}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
