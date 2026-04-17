import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');

  const handleLogin = () => {
    if (phone.length >= 10) {
      // Clear stale session data
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('upiId');
      localStorage.setItem('loginPhone', phone);
      navigate('/signup');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-dark-bg flex flex-col relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2" />

      {/* Header */}
      <div className="pt-20 pb-10 px-8 relative z-10">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center mb-6 glow-primary"
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z" stroke="white" strokeWidth="1.5" fill="white" fillOpacity="0.15"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-white text-[28px] font-extrabold leading-tight"
        >
          Welcome to<br />Safe<span className="gradient-text">Pay</span>
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-text-secondary text-sm mt-3"
        >
          AI-powered UPI payments with behavioral protection
        </motion.p>
      </div>

      {/* Form */}
      <div className="px-6 pt-4 flex-1 relative z-10">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <label className="text-xs text-text-secondary font-medium mb-2 block">Mobile Number</label>
          <div className="flex items-center bg-dark-card border border-dark-border rounded-2xl px-4 py-4">
            <span className="text-primary font-semibold text-sm mr-2">+91</span>
            <div className="w-px h-5 bg-dark-border mr-3" />
            <input
              type="tel"
              maxLength={10}
              placeholder="Enter your mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="flex-1 outline-none text-white font-medium text-base bg-transparent placeholder:text-text-muted"
            />
            {phone.length === 10 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 bg-success rounded-full flex items-center justify-center"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
          </div>
        </motion.div>

        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogin}
          disabled={phone.length < 10}
          className={`w-full py-4 rounded-btn font-bold text-base mt-8 transition-all duration-300 ${
            phone.length >= 10
              ? 'bg-gradient-to-r from-primary to-primary-dark text-white glow-primary'
              : 'bg-dark-card text-text-muted border border-dark-border cursor-not-allowed'
          }`}
        >
          Continue
        </motion.button>

        <p className="text-center text-xs text-text-muted mt-6">
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-center pb-8 pt-4 relative z-10">
        <div className="flex items-center gap-2 text-text-muted text-[11px] tracking-wider">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          PROTECTED BY ISOLATION FOREST AI
        </div>
      </div>
    </motion.div>
  );
}
