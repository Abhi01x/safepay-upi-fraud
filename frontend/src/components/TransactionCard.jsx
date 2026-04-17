import RiskBadge from './RiskBadge';

export default function TransactionCard({ txn }) {
  const time = txn.created_at
    ? new Date(txn.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '';
  const date = txn.created_at
    ? new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  return (
    <div className="flex items-center justify-between py-3 px-1 border-b border-dark-border/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
          {(txn.payee_upi || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{txn.payee_upi || 'Unknown'}</p>
          <p className="text-[11px] text-text-muted">{date} {time}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">₹{(txn.amount || 0).toLocaleString('en-IN')}</span>
        <RiskBadge action={txn.action} score={txn.risk_score} />
      </div>
    </div>
  );
}
