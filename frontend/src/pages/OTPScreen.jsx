import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../utils/api';

export default function OTPScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { transactionData, form } = location.state || {};

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [otpPasted, setOtpPasted] = useState(false);
  const inputRefs = useRef([]);
  const pageStart = useRef(Date.now());

  useEffect(() => {
    if (!transactionData) {
      navigate('/send');
      return;
    }
    inputRefs.current[0]?.focus();
    const interval = setInterval(() => {
      setTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [transactionData, navigate]);

  const handleDigitChange = (index, value) => {
    if (value.length > 1) {
      // Paste detected
      const chars = value.slice(0, 6).split('');
      const newDigits = [...digits];
      chars.forEach((c, i) => {
        if (i + index < 6) newDigits[i + index] = c;
      });
      setDigits(newDigits);
      setOtpPasted(true);
      const nextIdx = Math.min(index + chars.length, 5);
      inputRefs.current[nextIdx]?.focus();
      if (newDigits.every(d => d !== '')) {
        submitOTP(newDigits);
      }
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newDigits.every(d => d !== '')) {
      submitOTP(newDigits);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitOTP = async (finalDigits) => {
    setLoading(true);
    const otpTime = (Date.now() - pageStart.current) / 1000;

    const fullData = {
      ...transactionData,
      otp_time_sec: transactionData.otp_time_sec !== undefined
        ? transactionData.otp_time_sec
        : Math.round(otpTime * 10) / 10,
      otp_paste_detected: otpPasted,
    };

    try {
      const result = await api.createTransaction(fullData);
      navigate('/result', {
        state: {
          result,
          form,
          transactionData: fullData,
        },
      });
    } catch (err) {
      alert(err.message || 'Transaction failed');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-dark-bg flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full mb-4"
        />
        <p className="text-white font-semibold">Verifying...</p>
        <p className="text-text-muted text-xs mt-1">Analyzing 21 behavioral signals</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-dark-bg flex flex-col relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />

      <div className="px-6 pt-14 pb-8 text-center relative z-10">
        <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#7C6FFF" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-white text-xl font-bold">Enter UPI PIN</h1>
        <p className="text-text-secondary text-sm mt-1">
          Paying <span className="text-white font-semibold">₹{parseFloat(form?.amount || 0).toLocaleString('en-IN')}</span> to <span className="text-primary font-medium">{form?.payee_upi}</span>
        </p>
      </div>

      <div className="px-6 flex justify-center gap-3 mb-8 relative z-10">
        {digits.map((digit, i) => (
          <motion.input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => handleKeyDown(i, e)}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all duration-200 bg-dark-card ${
              digit ? 'border-primary text-primary glow-primary' : 'border-dark-border text-white'
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8 relative z-10">
        <p className="text-text-secondary text-sm">
          {timer > 0 ? (
            <>Valid for <span className="text-primary font-bold">{timer}s</span></>
          ) : (
            <button className="text-primary font-semibold">Resend OTP</button>
          )}
        </p>
      </div>

      <div className="mt-auto px-6 pb-8 relative z-10">
        <div className="flex items-center justify-center gap-2 text-text-muted text-[11px]">
          <div className="w-1.5 h-1.5 bg-success rounded-full" />
          Secured with end-to-end encryption
        </div>
      </div>
    </motion.div>
  );
}
