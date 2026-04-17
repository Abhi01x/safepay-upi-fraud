import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../utils/api';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: localStorage.getItem('loginPhone') || '',
    pin: '',
  });
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const formStart = useRef(Date.now());

  useEffect(() => {
    getDeviceFingerprint().then(id => {
      localStorage.setItem('deviceId', id);
    });
  }, []);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const isValid = form.name && form.email && form.phone && form.pin.length >= 4;

  const [loadingMsg, setLoadingMsg] = useState('');

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setLoadingMsg('Creating account...');
    try {
      const res = await api.signup({
        name: form.name,
        email: form.email,
        phone: form.phone,
      });
      localStorage.setItem('userId', String(res.user_id));
      localStorage.setItem('userName', form.name);
      localStorage.setItem('upiId', res.upi_id);

      setToast('Account created! Head to Profile to train your AI.');
      setTimeout(() => navigate('/home'), 1200);
    } catch (err) {
      setToast(err.message || 'Signup failed');
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-dark-card border border-dark-border rounded-2xl px-4 py-4 outline-none text-sm text-white font-medium placeholder:text-text-muted focus:border-primary/50 transition-colors";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-dark-bg relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/8 rounded-full blur-[100px]" />

      {toast && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 bg-success text-white px-6 py-3 rounded-2xl shadow-lg z-50 text-sm font-semibold glow-success"
        >
          {toast}
        </motion.div>
      )}

      <div className="px-6 pt-14 pb-6 relative z-10">
        <button onClick={() => navigate('/login')} className="text-text-secondary mb-6 w-10 h-10 bg-dark-card border border-dark-border rounded-full flex items-center justify-center">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white text-2xl font-extrabold">Create Account</h1>
        <p className="text-text-secondary text-sm mt-1">Setup your SafePay profile</p>
      </div>

      <div className="px-6 pb-8 space-y-4 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Full Name</label>
          <input type="text" placeholder="Enter your full name" value={form.name}
            onChange={(e) => handleChange('name', e.target.value)} className={inputCls} />
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Email</label>
          <input type="email" placeholder="you@email.com" value={form.email}
            onChange={(e) => handleChange('email', e.target.value)} className={inputCls} />
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">Phone Number</label>
          <div className="flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-4">
            <span className="text-primary font-semibold text-sm mr-2">+91</span>
            <div className="w-px h-5 bg-dark-border mr-3" />
            <input type="tel" maxLength={10} placeholder="Mobile number" value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
              className="flex-1 outline-none text-sm text-white font-medium bg-transparent placeholder:text-text-muted" />
          </div>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          <label className="text-xs text-text-secondary font-medium mb-1.5 block">UPI PIN</label>
          <div className="flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-4">
            <input type={showPin ? 'text' : 'password'} maxLength={6} placeholder="Enter 4-6 digit PIN" value={form.pin}
              onChange={(e) => handleChange('pin', e.target.value.replace(/\D/g, ''))}
              className="flex-1 outline-none text-sm text-white font-medium bg-transparent tracking-[0.3em] placeholder:text-text-muted placeholder:tracking-normal" />
            <button onClick={() => setShowPin(!showPin)} className="text-text-muted ml-2">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                {showPin ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </motion.div>

        <motion.button
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading || !isValid}
          className={`w-full py-4 rounded-btn font-bold text-base mt-4 transition-all duration-300 ${
            !loading && isValid
              ? 'bg-gradient-to-r from-primary to-primary-dark text-white glow-primary'
              : 'bg-dark-card text-text-muted border border-dark-border cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              {loadingMsg || 'Creating...'}
            </span>
          ) : 'Create Account'}
        </motion.button>
      </div>
    </motion.div>
  );
}
