import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import PartDetail from './pages/PartDetail';
import Printers from './pages/Printers';
import PrintLogs from './pages/PrintLogs';
import Inventory from './pages/Inventory';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/products" />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:productId" element={<ProductDetail />} />
            <Route path="parts/:partId" element={<PartDetail />} />
            <Route path="printers" element={<Printers />} />
            <Route path="printlogs" element={<PrintLogs />} />
            <Route path="inventory" element={<Inventory />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
