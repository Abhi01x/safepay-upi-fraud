import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../utils/api';
import BottomNav from '../components/BottomNav';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

const COLORS = { allow: '#00D68F', review: '#FFB347', block: '#FF4757' };

export default function Dashboard() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { navigate('/login'); return; }
    api.getAnalytics(userId).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className="h-screen bg-dark-bg flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-text-secondary text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen bg-dark-bg flex items-center justify-center">
        <p className="text-text-muted">No analytics data available</p>
      </div>
    );
  }

  const { risk_distribution: dist, risk_timeline, hour_heatmap, top_flags, total_transactions, amount_stats, model_trained, model_type } = data;

  const pieData = [
    { name: 'Allowed', value: dist.allow, color: COLORS.allow },
    { name: 'Review', value: dist.review, color: COLORS.review },
    { name: 'Blocked', value: dist.block, color: COLORS.block },
  ].filter(d => d.value > 0);

  const timelineData = risk_timeline.map((t, i) => ({
    name: `#${i + 1}`,
    score: t.score,
    amount: t.amount,
    action: t.action,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-xs">
        <p className="text-white font-semibold">Risk: {d.score}</p>
        <p className="text-text-muted">Amount: ₹{d.amount?.toLocaleString('en-IN')}</p>
        <p className={`font-bold ${d.action === 'allow' ? 'text-success' : d.action === 'review' ? 'text-warning' : 'text-danger'}`}>
          {d.action?.toUpperCase()}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-dark-bg pb-24 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2" />

      {/* Header */}
      <div className="px-6 pt-14 pb-4 relative z-10">
        <h1 className="text-white text-xl font-extrabold">AI Analytics</h1>
        <p className="text-text-muted text-xs mt-1">Real-time fraud intelligence dashboard</p>
      </div>

      {/* Stat Cards */}
      <div className="px-6 mb-5 grid grid-cols-3 gap-3 relative z-10">
        {[
          { label: 'Total', value: total_transactions, color: 'text-white' },
          { label: 'Blocked', value: dist.block, color: 'text-danger' },
          { label: 'Avg Amt', value: `₹${amount_stats.mean}`, color: 'text-primary' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.05 }}
            className="bg-dark-card border border-dark-border rounded-2xl p-3 text-center">
            <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-text-muted font-medium mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Risk Timeline Chart */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-dark-card border border-dark-border rounded-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Risk Score Timeline</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C6FFF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C6FFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5C5C7A' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5C5C7A' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="score" stroke="#7C6FFF" strokeWidth={2} fill="url(#riskGrad)" dot={{ r: 3, fill: '#7C6FFF' }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Distribution + Heatmap Row */}
      <div className="px-6 mb-5 grid grid-cols-2 gap-3 relative z-10">
        {/* Pie Chart */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-dark-card border border-dark-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-white mb-2">Distribution</h3>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={0}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 mt-1">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-[9px] text-text-muted">{d.name}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Hour Heatmap */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
          className="bg-dark-card border border-dark-border rounded-card p-4">
          <h3 className="text-xs font-semibold text-white mb-2">Activity Hours</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={hour_heatmap.filter(h => h.count > 0)}>
              <XAxis dataKey="hour" tick={{ fontSize: 8, fill: '#5C5C7A' }} axisLine={false} tickLine={false} />
              <Bar dataKey="count" fill="#7C6FFF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Model Info */}
      <div className="px-6 mb-5 relative z-10">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
          className="bg-dark-card border border-dark-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#7C6FFF"><path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold">{model_type}</p>
            <p className="text-text-muted text-[10px]">{model_trained ? 'Trained and active' : 'Still learning...'}</p>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${model_trained ? 'bg-success' : 'bg-warning animate-pulse'}`} />
        </motion.div>
      </div>

      {/* Top Risk Flags */}
      {top_flags?.length > 0 && (
        <div className="px-6 mb-5 relative z-10">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
            className="bg-dark-card border border-dark-border rounded-card p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Top Risk Signals</h3>
            {top_flags.slice(0, 6).map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-dark-border/50 last:border-0">
                <span className="text-xs text-text-secondary flex-1 mr-3">{f.flag}</span>
                <span className="text-[10px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full flex-shrink-0">{f.count}x</span>
              </div>
            ))}
          </motion.div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
