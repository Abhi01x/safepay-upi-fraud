export default function RiskBadge({ action, score }) {
  const config = {
    allow: { bg: 'bg-success/15', text: 'text-success', label: 'Safe' },
    review: { bg: 'bg-warning/15', text: 'text-warning', label: 'Review' },
    block: { bg: 'bg-danger/15', text: 'text-danger', label: 'Blocked' },
  };

  const c = config[action] || config.allow;

  return (
    <span className={`${c.bg} ${c.text} text-[10px] font-bold px-2.5 py-1 rounded-full`}>
      {c.label}
    </span>
  );
}
