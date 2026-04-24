"use client";

import { DollarSign } from "lucide-react";

interface CostBadgeProps {
  cost: number;
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}

export function CostBadge({ cost, label, size = "xs", className = "" }: CostBadgeProps) {
  function fmt(usd: number): string {
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(3)}`;
    return `${(usd * 100).toFixed(1)}¢`;
  }

  const sizeClass = size === "sm"
    ? "text-xs px-2 py-1 gap-1"
    : "text-xs px-1.5 py-0.5 gap-0.5";

  return (
    <span className={`inline-flex items-center ${sizeClass} bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400/70 font-mono ${className}`}>
      <DollarSign className={size === "sm" ? "w-3 h-3" : "w-2.5 h-2.5"} />
      {label && <span className="text-yellow-400/50 mr-0.5">{label}</span>}
      ~{fmt(cost)}
    </span>
  );
}

interface CostSummaryProps {
  items: Array<{ label: string; cost: number; qty?: number }>;
}

export function CostSummary({ items }: CostSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.cost * (item.qty || 1), 0);

  function fmt(usd: number): string {
    if (usd >= 1) return `$${usd.toFixed(2)}`;
    if (usd >= 0.01) return `$${usd.toFixed(3)}`;
    return `${(usd * 100).toFixed(1)}¢`;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map(({ label, cost, qty }) => (
        <span key={label} className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-yellow-500/8 border border-yellow-500/15 rounded-full text-yellow-400/60 font-mono">
          <DollarSign className="w-2.5 h-2.5" />
          {label}: ~{fmt(cost * (qty || 1))}
          {qty && qty > 1 && <span className="text-yellow-400/40"> ×{qty}</span>}
        </span>
      ))}
      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-yellow-500/15 border border-yellow-500/25 rounded-full text-yellow-400/80 font-mono font-semibold">
        <DollarSign className="w-2.5 h-2.5" />
        Total: ~{fmt(total)}
      </span>
    </div>
  );
}
