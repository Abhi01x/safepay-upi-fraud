import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../utils/api';
import BottomNav from '../components/BottomNav';
import TransactionCard from '../components/TransactionCard';

export default function Profile() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingSim, setLoadingSim] = useState('');
  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    api.getProfile(userId).then(setProfile).catch(() => {});
    api.getTransactions(userId).then(setTransactions).catch(() => {});
  }, [userId, navigate]);

  const handleSimulate = async (scenario) => {
    setLoadingSim(scenario);
    try {
      const data = await api.simulate(parseInt(userId), scenario);
      navigate('/send', { state: { prefill: data } });
    } catch { alert('Simulation failed'); }
    setLoadingSim('');
  };

  const handleLogout = () => { localStorage.clear(); navigate('/login'); };

  if (!profile) {
    return (<div className="h-screen bg-dark-bg flex items-center justify-center"><div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" /></div>);
  }

  const initials = profile.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const stats = [
    { label: 'Avg Typing', value: `${Math.round(profile.avg_typing_speed)}ms` },
    { label: 'Active Hours', value: `${profile.usual_hour_start}–${profile.usual_hour_end}h` },
    { label: 'Avg Amount', value: `₹${profile.avg_amount?.toLocaleString('en-IN')}` },
    { label: 'Known Payees', value: profile.known_payees?.length || 0 },
    { label: 'Transactions', value: profile.txn_count },
  ];

  return (
    <div className="min-h-screen bg-dark-bg pb-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/8 rounded-full blur-[120px] -translate-y-1/2" />

      {/* Header / Profile Card */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center text-white text-xl font-bold glow-primary">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-white text-lg font-bold">{profile.name}</h1>
            <p className="text-primary text-sm font-medium">{profile.upi_id}</p>
            <p className="text-text-muted text-xs">{profile.email}</p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
            profile.model_trained ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'
          }`}>
            {profile.model_trained ? 'AI Active' : `${profile.txn_count}/15`}
          </div>
        </div>
      </div>

      {/* Learning Mode Banner — shown until model is trained */}
      {!profile.model_trained && (
        <div className="px-6 mb-5 relative z-10">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/30 rounded-card p-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🧠</span>
                <h3 className="text-white text-sm font-bold">Learning Your Behavior</h3>
                <span className="ml-auto text-[10px] text-primary font-bold bg-primary/15 px-2 py-0.5 rounded-full">
                  {profile.txn_count}/15
                </span>
              </div>
              <p className="text-text-muted text-[11px] mb-4 leading-relaxed">
                Every real transaction trains the model on <span className="text-white font-semibold">your</span> patterns — typing, timing, payees, amounts.
                After <span className="text-primary font-semibold">{15 - profile.txn_count} more</span>, the IsolationForest model activates and starts scoring every txn in real-time.
              </p>

              {/* Progress bar */}
              <div className="h-2 bg-dark-bg/60 rounded-full overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (profile.txn_count / 15) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/send')}
                className="w-full py-3 bg-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
              >
                Make a Transaction →
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Behavioral Baseline Grid */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-dark-card border border-dark-border rounded-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#7C6FFF"><path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/></svg>
            Behavioral Fingerprint
          </h3>
          <div className="space-y-3">
            {stats.map(s => (
              <div key={s.label} className="flex justify-between items-center">
                <span className="text-xs text-text-muted">{s.label}</span>
                <span className="text-xs font-bold text-white">{s.value}</span>
              </div>
            ))}
          </div>
          {profile.known_payees?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-dark-border">
              <p className="text-xs text-text-muted mb-2">Trusted Payees</p>
              <div className="flex flex-wrap gap-2">
                {profile.known_payees.map((p, i) => (
                  <span key={i} className="text-[10px] bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">{p}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Model Info */}
      <div className="px-6 mb-5 relative z-10">
        <div className="bg-dark-card border border-dark-border rounded-2xl p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-semibold text-white">IsolationForest ML Engine</h3>
            <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">scikit-learn</span>
          </div>
          <p className="text-text-muted text-[11px] mb-3 leading-relaxed">
            Unsupervised tree-based anomaly detector. Same algorithm used by AWS Fraud Detector and Stripe Radar.
          </p>
          <div className="space-y-2">
            {[
              { label: 'Algorithm', value: 'IsolationForest (150 trees)' },
              { label: 'Training data', value: 'Your last 15+ transactions' },
              { label: 'Features', value: '7 continuous numeric signals' },
              { label: 'Inference latency', value: '~2 ms' },
              { label: 'Output', value: 'Anomaly score 0–1 → ±15 pts' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between bg-dark-bg/50 rounded-xl px-3 py-2">
                <span className="text-[10px] text-text-muted">{r.label}</span>
                <span className="text-[10px] text-white font-semibold">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Scenarios */}
      <div className="px-6 mb-5 relative z-10">
        <h3 className="text-sm font-semibold text-white mb-3">Demo Scenarios</h3>
        <div className="grid grid-cols-2 gap-3">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleSimulate('normal')} disabled={!!loadingSim}
            className="bg-dark-card border border-success/20 rounded-2xl py-4 px-3 flex flex-col items-center">
            <div className="w-10 h-10 bg-success/15 rounded-full flex items-center justify-center mb-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#00D68F" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <span className="text-success text-xs font-bold">Normal User</span>
            <span className="text-text-muted text-[10px] mt-0.5">Score {'<'} 40</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleSimulate('fraud')} disabled={!!loadingSim}
            className="bg-dark-card border border-danger/20 rounded-2xl py-4 px-3 flex flex-col items-center">
            <div className="w-10 h-10 bg-danger/15 rounded-full flex items-center justify-center mb-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#FF4757" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </div>
            <span className="text-danger text-xs font-bold">Fraud Attack</span>
            <span className="text-text-muted text-[10px] mt-0.5">Score {'>'} 70</span>
          </motion.button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="px-6 relative z-10">
        <h3 className="text-sm font-semibold text-white mb-3">Transaction History</h3>
        <div className="bg-dark-card border border-dark-border rounded-card p-4">
          {transactions.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">No transactions yet</p>
          ) : transactions.slice(0, 10).map((txn) => <TransactionCard key={txn.id} txn={txn} />)}
        </div>
      </div>

      {/* Logout */}
      <div className="px-6 mt-6 relative z-10">
        <button onClick={handleLogout} className="w-full py-3 bg-danger/10 border border-danger/20 rounded-2xl text-danger text-sm font-bold">Logout</button>
      </div>

      <BottomNav />
    </div>
  );
}
