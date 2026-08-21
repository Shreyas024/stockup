import { formatPct, formatPrice, type SessionClosePrediction } from '../lib/api'

export function ClosePredictionCard({
  prediction,
  accent,
}: {
  prediction: SessionClosePrediction
  accent: 'teal' | 'coral'
}) {
  const up = prediction.vsLastClose >= 0
  const isActual = Boolean(prediction.isActual)
  const ring = isActual
    ? 'border-gain/30 bg-gain/5'
    : accent === 'teal'
      ? 'border-teal/25 bg-teal/5'
      : 'border-coral/25 bg-coral/5'
  const titleColor = isActual ? 'text-gain' : accent === 'teal' ? 'text-teal' : 'text-coral'

  return (
    <div className={`rounded-2xl border px-5 py-5 shadow-sm ${ring}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${titleColor}`}>
        {prediction.label}
      </p>
      <p className="mt-1 text-sm text-ink-soft/70">
        {prediction.weekday} · {prediction.date}
      </p>
      <p className="mt-3 font-display text-4xl tabular-nums text-ink">
        ₹{formatPrice(prediction.predicted)}
      </p>
      {isActual ? (
        <p className="mt-2 text-sm font-medium text-gain">Official session close from market data</p>
      ) : (
        <p className={`mt-2 text-sm font-medium tabular-nums ${up ? 'text-gain' : 'text-loss'}`}>
          {up ? '+' : ''}
          {formatPrice(prediction.vsLastClose)} ({formatPct(prediction.vsLastClosePercent)}) vs last close
        </p>
      )}
      {!isActual && (
        <p className="mt-3 text-xs text-ink-soft/60">
          Range ₹{formatPrice(prediction.low)} – ₹{formatPrice(prediction.high)}
        </p>
      )}
    </div>
  )
}
