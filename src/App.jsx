import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ShoppingCart, CheckCircle, BarChart3, Store } from 'lucide-react';
import CustomerView from './pages/CustomerView';
import CheckoutView from './pages/CheckoutView';
import ManagerDashboard from './pages/ManagerDashboard';

function Navbar() {
  const location = useLocation();
  return (
    <nav className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.25rem', fontWeight: 'bold' }}>
        <Store className="text-accent" />
        Mall Billing System
      </div>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
          <ShoppingCart size={18} style={{ display: 'inline', marginRight: 6 }}/> Customer
        </Link>
        <Link to="/checkout" className={`nav-link ${location.pathname === '/checkout' ? 'active' : ''}`}>
          <CheckCircle size={18} style={{ display: 'inline', marginRight: 6 }}/> Central Checkout
        </Link>
        <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
          <BarChart3 size={18} style={{ display: 'inline', marginRight: 6 }}/> Dashboard
        </Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container animate-fade-in">
        <Routes>
          <Route path="/" element={<CustomerView />} />
          <Route path="/checkout" element={<CheckoutView />} />
          <Route path="/dashboard" element={<ManagerDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
