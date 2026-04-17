import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      const userId = localStorage.getItem('userId');
      navigate(userId ? '/home' : '/login');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: '#0F0F1E' }}
    >
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-purple-500/15 rounded-full blur-[80px]" />

      {/* Shield icon with glow ring */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 150, damping: 15 }}
        className="relative mb-8"
      >
        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center glow-primary">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z" fill="white" fillOpacity="0.15"/>
            <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {/* Pulse rings */}
        <motion.div
          animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2 border-primary/40"
        />
        <motion.div
          animate={{ scale: [1, 2.2], opacity: [0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          className="absolute inset-0 rounded-full border border-primary/20"
        />
      </motion.div>

      <motion.h1
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-white text-[32px] font-extrabold tracking-tight"
      >
        Safe<span className="gradient-text">Pay</span>
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-text-secondary text-sm mt-2 tracking-wide"
      >
        Secured by Behavioral AI
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="flex gap-2 mt-12"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            className="w-2 h-2 rounded-full bg-primary"
          />
        ))}
      </motion.div>

      {/* Bottom tagline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 flex items-center gap-2"
      >
        <div className="w-1 h-1 rounded-full bg-success" />
        <span className="text-text-muted text-[11px] tracking-wider uppercase">
          IsolationForest • Real-time Protection
        </span>
      </motion.div>
    </motion.div>
  );
}
