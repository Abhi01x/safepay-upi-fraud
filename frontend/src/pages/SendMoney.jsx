import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BiometricCollector } from '../utils/biometrics';
import { getDeviceFingerprint, getIpInfo, getDeviceSignals } from '../utils/deviceFingerprint';
import { api } from '../utils/api';
import QRScanner from '../components/QRScanner';

export default function SendMoney() {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = localStorage.getItem('userId');
  const biometrics = useRef(new BiometricCollector());
  const prefill = location.state?.prefill || null;

  const [form, setForm] = useState({
    payee_upi: prefill?.payee_upi || '',
    amount: prefill?.amount?.toString() || '',
    note: prefill?.note || '',
  });
  const [upiValid, setUpiValid] = useState(false);
  const [simulatedData] = useState(prefill || null);
  const [liveBio, setLiveBio] = useState({ typing: 0, mouse: 0, keys: 0, session: 0 });
  const [showScanner, setShowScanner] = useState(location.state?.openScanner === true);
  const [scannedName, setScannedName] = useState('');
  const [reported, setReported] = useState(null);   // { is_reported, total_reports }
  const reportCheckTimer = useRef(null);

  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    biometrics.current.startTracking();
    const interval = setInterval(() => {
      const d = biometrics.current.getData();
      setLiveBio({
        typing: d.typing_speed_ms,
        mouse: d.mouse_movement_score,
        keys: biometrics.current.keyTimestamps.length,
        session: d.session_duration_sec,
      });
    }, 500);
    return () => { biometrics.current.stopTracking(); clearInterval(interval); };
  }, [userId, navigate]);

  useEffect(() => {
    const valid = /^[\w.\-]+@[\w]+$/.test(form.payee_upi);
    setUpiValid(valid);

    // Federated scammer blocklist check (FEATURE A) — debounced 350ms
    if (reportCheckTimer.current) clearTimeout(reportCheckTimer.current);
    if (!valid) { setReported(null); return; }
    reportCheckTimer.current = setTimeout(async () => {
      try {
        const r = await api.checkReported(form.payee_upi);
        setReported(r);
      } catch {
        setReported(null);
      }
    }, 350);
    return () => reportCheckTimer.current && clearTimeout(reportCheckTimer.current);
  }, [form.payee_upi]);

  const handleScan = (parsed) => {
    setShowScanner(false);
    setForm(prev => ({
      ...prev,
      payee_upi: parsed.upi || prev.payee_upi,
      amount: parsed.amount || prev.amount,
      note: parsed.note || prev.note,
    }));
    setScannedName(parsed.name || '');
  };

  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const canProceed = upiValid && form.amount && parseFloat(form.amount) > 0;

  const handleProceed = async () => {
    if (!canProceed) return;
    const bio = biometrics.current.getData();
    const deviceId = localStorage.getItem('deviceId') || await getDeviceFingerprint();
    const storedDeviceId = localStorage.getItem('knownDeviceId');
    const isNewDevice = storedDeviceId ? storedDeviceId !== deviceId : false;
    localStorage.setItem('knownDeviceId', deviceId);
    const ipInfo = await getIpInfo();
    const storedIp = localStorage.getItem('lastIp');
    const ipChanged = storedIp ? storedIp !== ipInfo.ip_address : false;
    localStorage.setItem('lastIp', ipInfo.ip_address);
    const deviceSignals = getDeviceSignals();
    let isNewPayee = true;
    try {
      const profile = await api.getProfile(userId);
      if (profile.known_payees?.includes(form.payee_upi)) isNewPayee = false;
    } catch {}
    const now = new Date();
    const userAvg = parseFloat(localStorage.getItem('avgAmount')) || 2400;
    const amount = parseFloat(form.amount);

    const transactionData = {
      user_id: parseInt(userId),
      typing_speed_ms: simulatedData?.typing_speed_ms ?? bio.typing_speed_ms,
      session_duration_sec: simulatedData?.session_duration_sec ?? bio.session_duration_sec,
      copy_paste_detected: simulatedData?.copy_paste_detected ?? bio.copy_paste_detected,
      field_hesitation: simulatedData?.field_hesitation ?? bio.field_hesitation,
      backspace_count: simulatedData?.backspace_count ?? bio.backspace_count,
      mouse_movement_score: simulatedData?.mouse_movement_score ?? bio.mouse_movement_score,
      device_id: deviceId,
      is_new_device: simulatedData?.is_new_device ?? isNewDevice,
      screen_resolution: deviceSignals.screen_resolution,
      timezone: deviceSignals.timezone,
      ip_address: ipInfo.ip_address,
      ip_country: simulatedData?.ip_country ?? ipInfo.ip_country,
      ip_city: simulatedData?.ip_city ?? ipInfo.ip_city,
      is_vpn: simulatedData?.is_vpn ?? ipInfo.is_vpn,
      ip_changed: simulatedData?.ip_changed ?? ipChanged,
      amount, payee_upi: form.payee_upi,
      is_new_payee: simulatedData?.is_new_payee ?? isNewPayee,
      hour_of_day: simulatedData?.hour_of_day ?? now.getHours(),
      day_of_week: simulatedData?.day_of_week ?? now.getDay(),
      amount_vs_avg: amount / userAvg,
      note: form.note,
      ...(simulatedData?.otp_time_sec !== undefined && { otp_time_sec: simulatedData.otp_time_sec }),
    };
    navigate('/otp', { state: { transactionData, form } });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="min-h-screen bg-dark-bg relative overflow-hidden">
      <div className="absolute top-20 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />

      {/* AI Banner */}
      <div className="bg-primary/10 border-b border-primary/10 py-2.5 px-4 flex items-center justify-center gap-2">
        <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
        <span className="text-primary text-xs font-semibold">AI Protection Active — Collecting biometrics</span>
      </div>

      {/* Header */}
      <div className="px-6 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => navigate('/home')} className="w-10 h-10 bg-dark-card border border-dark-border rounded-full flex items-center justify-center">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#8B8BA7" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white text-lg font-bold">Send Money</h1>
      </div>

      {simulatedData && (
        <div className="mx-6 mt-3 bg-warning/10 border border-warning/20 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-warning text-sm">⚡</span>
          <span className="text-warning text-xs font-semibold">Simulation — biometrics pre-filled for demo</span>
        </div>
      )}

      {/* Live Biometric Indicators — judges love this */}
      {!simulatedData && (
        <div className="mx-6 mt-3">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-3">
            <p className="text-[10px] text-text-muted font-semibold mb-2 uppercase tracking-wider">Live Biometric Collection</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Typing', value: `${liveBio.typing}ms`, active: liveBio.keys > 0 },
                { label: 'Mouse', value: liveBio.mouse, active: liveBio.mouse > 0 },
                { label: 'Keys', value: liveBio.keys, active: liveBio.keys > 0 },
                { label: 'Time', value: `${liveBio.session}s`, active: true },
              ].map(b => (
                <div key={b.label} className="text-center">
                  <p className={`text-xs font-bold ${b.active ? 'text-primary' : 'text-text-muted'}`}>{b.value}</p>
                  <p className="text-[8px] text-text-muted">{b.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="px-6 pt-5 space-y-4 relative z-10">
        {/* Scan QR button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowScanner(true)}
          className="w-full bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-2xl py-3.5 flex items-center justify-center gap-2.5"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7C6FFF" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v4H4V4zm12 0h4v4h-4V4zM4 16h4v4H4v-4zm12 0h4v4h-4v-4zm-6-6h4v4h-4v-4z" />
          </svg>
          <span className="text-primary text-sm font-bold">Scan UPI QR Code</span>
        </motion.button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-dark-border" />
          <span className="text-text-muted text-[10px] uppercase tracking-wider">or enter manually</span>
          <div className="flex-1 h-px bg-dark-border" />
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Recipient UPI ID</label>
          <div className="flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-4 focus-within:border-primary/40 transition-colors">
            <input type="text" placeholder="name@bank" value={form.payee_upi}
              onChange={(e) => handleChange('payee_upi', e.target.value)}
              className="flex-1 outline-none text-sm text-white font-medium bg-transparent placeholder:text-text-muted" />
            {form.payee_upi && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                className={`w-6 h-6 rounded-full flex items-center justify-center ${upiValid ? 'bg-success' : 'bg-dark-border'}`}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                  {upiValid
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  }
                </svg>
              </motion.div>
            )}
          </div>
          {scannedName && (
            <p className="text-[11px] text-success mt-1.5 font-semibold flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#00D68F"><path d="M9 12l2 2 4-4 1.5 1.5L11 17 7.5 13.5z"/></svg>
              {scannedName} (from QR)
            </p>
          )}

          {/* FEATURE A: reported scammer warning banner */}
          {reported?.is_reported && (
            <motion.div
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mt-2 bg-danger/15 border border-danger/40 rounded-2xl px-3.5 py-2.5 flex items-start gap-2.5"
            >
              <div className="w-7 h-7 rounded-full bg-danger/20 flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="#FF4757" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 6l7.5 13h-15L12 8zm-1 4v4h2v-4h-2zm0 5v2h2v-2h-2z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-danger text-xs font-bold">Reported scammer UPI</p>
                <p className="text-[11px] text-text-secondary leading-tight mt-0.5">
                  Flagged by <span className="font-bold text-danger">{reported.total_reports}</span> {reported.total_reports === 1 ? 'user' : 'users'} as suspicious. Proceeding is risky.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Amount</label>
          <div className="flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-4 focus-within:border-primary/40 transition-colors">
            <span className="gradient-text font-extrabold text-xl mr-3">₹</span>
            <input type="number" placeholder="0" value={form.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              className="flex-1 outline-none text-[28px] text-white font-extrabold bg-transparent placeholder:text-dark-border" />
          </div>
        </div>

        <div>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Note (optional)</label>
          <input type="text" placeholder="What's this for?" value={form.note}
            onChange={(e) => handleChange('note', e.target.value)}
            className="w-full bg-dark-card border border-dark-border rounded-2xl px-4 py-4 outline-none text-sm text-white font-medium placeholder:text-text-muted focus:border-primary/40 transition-colors" />
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={handleProceed} disabled={!canProceed}
          className={`w-full py-4 rounded-btn font-bold text-base mt-2 transition-all duration-300 ${
            canProceed ? 'bg-gradient-to-r from-primary to-primary-dark text-white glow-primary' : 'bg-dark-card text-text-muted border border-dark-border cursor-not-allowed'
          }`}>
          Proceed to Pay
        </motion.button>
      </div>

      {/* QR Scanner modal */}
      <AnimatePresence>
        {showScanner && (
          <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
