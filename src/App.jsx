import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PDV from './pages/PDV'
import CashRegister from './pages/CashRegister'
import Products from './pages/Products'
import Profit from './pages/Profit'
import Team from './pages/Team'
import Categories from './pages/Categories'
import Suppliers from './pages/Suppliers'
import Security from './pages/Security'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pdv" element={<PDV />} />
            <Route path="caixa" element={<CashRegister />} />
            <Route path="produtos" element={<Products />} />
            <Route path="lucro" element={<Profit />} />
            <Route path="equipa" element={<Team />} />
            <Route path="categorias" element={<Categories />} />
            <Route path="fornecedores" element={<Suppliers />} />
            <Route path="seguranca" element={<Security />} />
          </Route>

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
