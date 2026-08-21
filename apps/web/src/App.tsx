import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { WatchlistProvider } from './hooks/useWatchlist'
import { AnalysePage } from './pages/AnalysePage'
import { GuidePage } from './pages/GuidePage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { StockPage } from './pages/StockPage'
import { WatchlistPage } from './pages/WatchlistPage'

export default function App() {
  return (
    <BrowserRouter>
      <WatchlistProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/stock/:exchange/:symbol" element={<StockPage />} />
            <Route path="/stock/:exchange/:symbol/analyse" element={<AnalysePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </WatchlistProvider>
    </BrowserRouter>
  )
}
