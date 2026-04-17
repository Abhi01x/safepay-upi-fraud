import { motion } from 'framer-motion';

export default function BiometricStatus({ txnCount, modelTrained }) {
  const isActive = modelTrained || txnCount >= 15;
  const progress = Math.min(txnCount, 15);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
        isActive
          ? 'bg-success/15 text-success'
          : 'bg-primary/15 text-primary'
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success' : 'bg-primary'} ${!isActive ? 'animate-pulse' : ''}`} />
      {isActive ? 'AI Active' : `${progress}/15`}
    </motion.div>
  );
}
