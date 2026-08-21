import { Link } from 'react-router-dom'

const STEPS = [
  {
    title: '1. Find a stock',
    body: 'Use the search bar in the header or on the home page. Type at least 2 letters to see matching NSE/BSE names, then click a suggestion or press Search for the full list.',
  },
  {
    title: '2. Check the live quote',
    body: 'Open any stock to see the current price, day’s change, OHLC stats, and a historical chart. The price refreshes automatically every few seconds while the page is open.',
  },
  {
    title: '3. Read today & tomorrow close forecasts',
    body: 'On the stock page you’ll see predicted closing prices for today and tomorrow (next trading session on weekends). These are educational estimates from past price patterns—not guarantees.',
  },
  {
    title: '4. Run Analyse',
    body: 'Click “Analyse stock”. StockUp scores recent history with SMA 20/50/200, RSI, and MACD, then suggests Buy, Hold, or Sell with reasons. You’ll also get a longer forecast chart; use Forecast horizon to choose how many days ahead to display.',
  },
  {
    title: '5. Save to My watchlist',
    body: 'Click “Add to watchlist” (☆) on a stock, search result, or trending row. Open My watchlist in the header anytime to revisit saved names. Your list is stored in this browser only.',
  },
]

const INDICATORS = [
  {
    name: 'SMA 20 / 50 / 200',
    meaning: 'Average price over the last 20, 50, or 200 trading days. Price above the average often signals strength for that timeframe; below can signal weakness.',
  },
  {
    name: 'RSI 14',
    meaning: 'Momentum score from 0–100. Near or below 30 can look oversold; near or above 70 can look overbought. Mid-range is more neutral.',
  },
  {
    name: 'MACD',
    meaning: 'Compares shorter and longer trend averages. A positive histogram usually means bullish momentum; negative means bearish momentum.',
  },
  {
    name: 'Buy / Hold / Sell',
    meaning: 'A simple score from those indicators plus recent trend. Treat it as a starting point for your own research, not as an order to trade.',
  },
]

export function GuidePage() {
  return (
    <div className="animate-rise mx-auto max-w-3xl space-y-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal">Help</p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">How to use StockUp</h1>
        <p className="mt-3 text-lg text-ink-soft/85">
          A short walkthrough: find stocks, read live data, analyse past trends, and save names you care about.
        </p>
      </div>

      <section className="space-y-4">
        {STEPS.map((step) => (
          <article
            key={step.title}
            className="rounded-2xl border border-mist bg-white/80 px-5 py-4 shadow-sm"
          >
            <h2 className="text-base font-semibold text-ink">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft/85">{step.body}</p>
          </article>
        ))}
      </section>

      <section>
        <h2 className="font-display text-3xl text-ink">How analysis works</h2>
        <p className="mt-2 text-sm text-ink-soft/80">
          Analyse downloads up to 5 years of daily prices. The Buy/Hold/Sell signal and indicators use that history;
          the ML forecast mainly looks at about the last 9 months to sketch a possible path ahead.
        </p>
        <ul className="mt-5 space-y-3">
          {INDICATORS.map((item) => (
            <li key={item.name} className="rounded-xl border border-mist bg-white/70 px-4 py-3">
              <p className="text-sm font-semibold text-teal">{item.name}</p>
              <p className="mt-1 text-sm text-ink-soft/85">{item.meaning}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="rounded-xl border border-coral/25 bg-coral/5 px-4 py-3 text-sm text-ink-soft">
        Not financial advice. Forecasts and signals are educational estimates based on historical patterns and do not
        guarantee future performance. Always do your own research before investing.
      </aside>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/"
          className="rounded-xl bg-teal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink"
        >
          Go to home
        </Link>
        <Link
          to="/search?q=RELIANCE"
          className="rounded-xl border border-mist bg-white px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-teal/40"
        >
          Try a sample stock
        </Link>
      </div>
    </div>
  )
}
