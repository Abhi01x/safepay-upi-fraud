import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function RiskGauge({ score }) {
  const rotation = (score / 100) * 180 - 90;
  const color = score < 40 ? '#00D68F' : score < 70 ? '#FFB347' : '#FF4757';
  return (
    <div className="relative w-52 h-32 mx-auto mb-4">
      <svg viewBox="0 0 200 110" className="w-full">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#2A2A4A" strokeWidth="12" strokeLinecap="round" />
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 251} 251`} className="transition-all duration-1000" style={{ filter: `drop-shadow(0 0 8px ${color}60)` }} />
        <motion.line x1="100" y1="100" x2="100" y2="30" stroke={color} strokeWidth="3" strokeLinecap="round"
          initial={{ rotate: -90 }} animate={{ rotate: rotation }} transition={{ duration: 1, type: 'spring' }}
          style={{ transformOrigin: '100px 100px' }} />
        <circle cx="100" cy="100" r="6" fill={color} />
      </svg>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className="text-3xl font-extrabold" style={{ color }}>{Math.round(score)}</span>
        <span className="text-text-muted text-xs">/100</span>
      </div>
    </div>
  );
}

function FlagRow({ flag }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-dark-border/50 last:border-0">
      <span className="text-danger text-sm mt-0.5">⚡</span>
      <span className="text-sm text-text-secondary">{flag}</span>
    </div>
  );
}

function ActivationModal({ onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.6, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        className="bg-dark-card border border-success/40 rounded-3xl p-8 text-center max-w-sm w-full relative overflow-hidden"
      >
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-success/30 rounded-full blur-3xl" />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: [0, -12, 12, 0] }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative w-20 h-20 bg-gradient-to-br from-success to-emerald-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
        >
          <svg width="42" height="42" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
          </svg>
        </motion.div>
        <motion.h2 initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-white text-xl font-extrabold mb-1 relative">AI Model Activated</motion.h2>
        <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-success text-sm font-semibold mb-3 relative">Trained on 15 of your transactions</motion.p>
        <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-text-muted text-xs leading-relaxed mb-5 relative">
          IsolationForest is now live — the same anomaly detection algorithm used by AWS Fraud Detector and Stripe Radar.
          From your next transaction onwards, every payment is scored in <span className="text-white font-semibold">&lt;50ms</span> against your behavioral baseline.
        </motion.p>
        <motion.button
          initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.96 }}
          onClick={onClose}
          className="w-full py-3 bg-success text-dark-bg text-sm font-bold rounded-xl relative"
        >
          Continue →
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { result, form } = location.state || {};
  const [showActivation, setShowActivation] = useState(false);
  const [reportState, setReportState] = useState('idle');   // idle | loading | done
  const [reportTotal, setReportTotal] = useState(0);

  const handleReport = async () => {
    if (reportState !== 'idle') return;
    setReportState('loading');
    try {
      const userId = parseInt(localStorage.getItem('userId'));
      const r = await api.reportPayee({
        user_id: userId,
        payee_upi: form?.payee_upi,
        reason: 'Reported from blocked transaction',
      });
      setReportTotal(r.total_reports || 1);
      setReportState('done');
    } catch {
      setReportState('idle');
    }
  };

  useEffect(() => {
    if (result?.just_trained) {
      const t = setTimeout(() => setShowActivation(true), 1400);
      return () => clearTimeout(t);
    }
  }, [result]);

  if (!result) {
    return (<div className="h-screen bg-dark-bg flex items-center justify-center"><p className="text-text-muted">No result data</p></div>);
  }

  const { action, risk_score, layer_scores, flags, mode, txn_count } = result;
  const txnId = `TXN${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const activationOverlay = (
    <AnimatePresence>
      {showActivation && <ActivationModal onClose={() => setShowActivation(false)} />}
    </AnimatePresence>
  );

  if (action === 'allow') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 bg-success/10 rounded-full blur-[100px]" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-24 h-24 bg-success rounded-full flex items-center justify-center mb-6 glow-success relative z-10">
          <motion.svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <motion.path d="M5 13l4 4L19 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5 }} />
          </motion.svg>
        </motion.div>
        <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
          className="text-3xl font-extrabold text-white mb-1 relative z-10">
          ₹{parseFloat(form?.amount || 0).toLocaleString('en-IN')} Sent!
        </motion.h1>
        <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
          className="text-text-secondary text-sm mb-6 relative z-10">To: <span className="text-primary">{form?.payee_upi}</span></motion.p>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
          className="bg-success/15 rounded-2xl px-6 py-3 mb-4 relative z-10">
          <span className="text-success font-bold text-sm">Safety Score: {Math.round(100 - risk_score)}/100</span>
        </motion.div>
        {mode === 'learning' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
            className="bg-primary/10 rounded-2xl px-4 py-2 mb-4 relative z-10">
            <span className="text-primary text-xs font-semibold">Learning mode — {txn_count}/15 transactions recorded</span>
          </motion.div>
        )}
        <p className="text-text-muted text-xs mb-8 relative z-10">Transaction ID: {txnId}</p>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/home')}
          className="w-full py-4 bg-gradient-to-r from-primary to-primary-dark rounded-btn text-white font-bold glow-primary relative z-10">Done</motion.button>
        {activationOverlay}
      </motion.div>
    );
  }

  if (action === 'review') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-dark-bg flex flex-col items-center px-6 pt-16 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-warning/8 rounded-full blur-[100px]" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
          className="w-24 h-24 bg-warning rounded-full flex items-center justify-center mb-6 relative z-10" style={{ boxShadow: '0 0 30px rgba(255,179,71,0.3)' }}>
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </motion.div>
        <h1 className="text-xl font-bold text-white mb-2 relative z-10">Verification Required</h1>
        <p className="text-text-secondary text-sm text-center mb-4 relative z-10">Our AI flagged some unusual patterns</p>
        <div className="relative z-10 w-full"><RiskGauge score={risk_score} /></div>
        <div className="w-full bg-dark-card border border-dark-border rounded-card p-4 mb-6 relative z-10">
          <h3 className="text-sm font-semibold text-white mb-2">Triggered Signals</h3>
          {flags.map((f, i) => <FlagRow key={i} flag={f} />)}
          {flags.length === 0 && <p className="text-text-muted text-xs">Minor deviations detected</p>}
        </div>
        <div className="w-full space-y-3 relative z-10">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/home')}
            className="w-full py-4 bg-gradient-to-r from-primary to-primary-dark rounded-btn text-white font-bold">Verify with Face ID</motion.button>
          <button onClick={() => navigate('/home')} className="w-full py-4 bg-dark-card border border-dark-border rounded-btn text-text-secondary font-semibold">Cancel</button>
        </div>
        {activationOverlay}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-dark-bg flex flex-col items-center px-6 pt-12 pb-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-danger/8 rounded-full blur-[100px]" />
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
        className="w-24 h-24 bg-danger rounded-full flex items-center justify-center mb-6 glow-danger relative z-10">
        <motion.svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <motion.path d="M6 18L18 6M6 6l12 12" stroke="white" strokeWidth="3" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.3 }} />
        </motion.svg>
      </motion.div>
      <h1 className="text-xl font-bold text-white mb-2 relative z-10">Transaction Blocked</h1>
      <p className="text-text-secondary text-sm text-center mb-6 relative z-10">Our AI detected unusual activity</p>
      <div className="relative z-10 w-full"><RiskGauge score={risk_score} /></div>
      <div className="w-full bg-dark-card border border-dark-border rounded-card p-4 mb-4 relative z-10">
        <h3 className="text-sm font-semibold text-white mb-3">Risk Breakdown</h3>
        {Object.entries(layer_scores || {}).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-dark-border/50 last:border-0">
            <span className="text-sm text-text-secondary capitalize">{key}</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-dark-border rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.8 }}
                  className={`h-full rounded-full ${val < 30 ? 'bg-success' : val < 60 ? 'bg-warning' : 'bg-danger'}`} />
              </div>
              <span className="text-xs font-bold text-white w-8 text-right">{Math.round(val)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="w-full bg-dark-card border border-dark-border rounded-card p-4 mb-6 relative z-10">
        <h3 className="text-sm font-semibold text-white mb-2">Detected Anomalies</h3>
        {(flags || []).map((f, i) => <FlagRow key={i} flag={f} />)}
      </div>
      <div className="w-full space-y-3 mt-auto relative z-10">
        {reportState === 'done' ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full py-4 bg-success/15 border border-success/40 rounded-btn text-center">
            <p className="text-success font-bold text-sm">✓ Added to scammer blocklist</p>
            <p className="text-text-muted text-[11px] mt-0.5">
              {reportTotal} user{reportTotal === 1 ? '' : 's'} have now reported <span className="font-semibold text-text-secondary">{form?.payee_upi}</span>
            </p>
          </motion.div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleReport}
            disabled={reportState === 'loading'}
            className="w-full py-4 bg-danger rounded-btn text-white font-bold glow-danger disabled:opacity-60"
          >
            {reportState === 'loading' ? 'Reporting…' : 'Report as Scammer'}
          </motion.button>
        )}
        <button onClick={() => navigate('/home')}
          className="w-full py-4 bg-dark-card border border-dark-border rounded-btn text-text-secondary font-semibold">Go Back</button>
      </div>
      {activationOverlay}
    </motion.div>
  );
}
