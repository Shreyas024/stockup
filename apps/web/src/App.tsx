import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AnalysePage } from './pages/AnalysePage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { StockPage } from './pages/StockPage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/stock/:exchange/:symbol" element={<StockPage />} />
          <Route path="/stock/:exchange/:symbol/analyse" element={<AnalysePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
