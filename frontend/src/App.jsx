// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { ShoppingBag, LogOut, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import CustomerApp from './pages/CustomerApp';
import CashierDashboard from './pages/CashierDashboard';
import { API_BASE } from './config';
import './index.css';

export default function App() {
  const [mode, setMode] = useState('home'); // 'home', 'customer', 'cashier'
  const [sessionId, setSessionId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [customerScreen, setCustomerScreen] = useState('scanner'); // 'scanner', 'search', 'cart', 'checkout', 'receipt'

  // Calculate real-time cart item count
  const cartItemCount = cart.reduce((total, item) => total + (item.quantity || 1), 0);

  // Sync cart data if sessionId exists
  useEffect(() => {
    if (sessionId) {
      fetch(`${API_BASE}/api/cart/${sessionId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.items) {
            setCart(data.items);
          }
        })
        .catch((err) => console.error('Error fetching cart in App:', err));
    }
  }, [sessionId]);

  const handleLogout = () => {
    setMode('home');
    setSessionId(null);
    setCart([]);
    setCustomerScreen('scanner');
    setMobileMenuOpen(false);
  };

  const handleCartButtonClick = async () => {
    setMobileMenuOpen(false);
    if (!sessionId) {
      try {
        const response = await fetch(`${API_BASE}/api/sessions`, { method: 'POST' });
        const data = await response.json();
        setSessionId(data.sessionId);
      } catch (error) {
        console.error('Error creating session:', error);
      }
    }
    setMode('customer');
    setCustomerScreen('checkout');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans selection:bg-[#0066ff] selection:text-white">
      {/* SaaS-Style Light Navbar */}
      <header className="bg-white border-b border-[#e2e8f0] shadow-sm sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Logo: FlashCart with 'F' Icon */}
            <div
              className="flex items-center gap-3 cursor-pointer select-none group"
              onClick={() => setMode('home')}
            >
              <div className="w-9 h-9 rounded-lg bg-[#0066ff] flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:bg-[#0052cc] transition-colors">
                F
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-2xl tracking-tight text-[#0f172a]">
                  Flash<span className="text-[#0066ff]">Cart</span>
                </span>
                <span className="text-[11px] font-semibold text-[#64748b] tracking-wider uppercase hidden sm:inline">
                  Retail
                </span>
              </div>
            </div>

            {/* Desktop Navigation & Right Actions */}
            <div className="hidden md:flex gap-4 items-center">
              {mode !== 'home' && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#475569]">
                    {mode === 'customer' ? 'Customer Portal' : 'Cashier Terminal'}
                  </span>
                  {sessionId && (
                    <span className="text-xs font-mono font-medium px-2.5 py-1.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a]">
                      ID: {sessionId.slice(0, 8)}
                    </span>
                  )}
                </div>
              )}

              {/* Shopping Bag Button with Red Badge */}
              <button
                onClick={handleCartButtonClick}
                className="relative p-2.5 rounded-md bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#0f172a] hover:border-[#cbd5e1] transition cursor-pointer"
                title="View Bag & Checkout"
              >
                <ShoppingBag className="w-5 h-5 text-[#0f172a]" />
                <span
                  className={`absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center ring-2 ring-white shadow-xs ${
                    cartItemCount > 0 ? 'bg-[#ef4444]' : 'bg-[#94a3b8]'
                  }`}
                >
                  {cartItemCount}
                </span>
              </button>

              {mode !== 'home' && (
                <button
                  onClick={handleLogout}
                  className="bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] text-[#475569] hover:text-[#0f172a] px-3.5 py-2 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Exit
                </button>
              )}
            </div>

            {/* Mobile Actions */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={handleCartButtonClick}
                className="relative p-2 rounded-md bg-white border border-[#e2e8f0] text-[#0f172a]"
              >
                <ShoppingBag className="w-5 h-5" />
                <span
                  className={`absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center ring-2 ring-white ${
                    cartItemCount > 0 ? 'bg-[#ef4444]' : 'bg-[#94a3b8]'
                  }`}
                >
                  {cartItemCount}
                </span>
              </button>

              <button
                className="p-2 rounded-md bg-white border border-[#e2e8f0] text-[#0f172a]"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t border-[#e2e8f0] flex flex-col gap-2">
              {mode !== 'home' ? (
                <>
                  <div className="flex justify-between items-center text-xs px-1 text-[#475569]">
                    <span>{mode === 'customer' ? 'Customer Mode' : 'Cashier Mode'}</span>
                    <span className="font-mono text-[#0f172a]">{sessionId}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] py-2 px-3 rounded-md font-semibold text-xs flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4 text-[#64748b]" />
                    Exit Session
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setMode('customer');
                    }}
                    className="w-full bg-[#0066ff] text-white py-2 px-3 rounded-md font-bold text-xs"
                  >
                    Customer Self-Checkout
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setMode('cashier');
                    }}
                    className="w-full bg-white border border-[#e2e8f0] text-[#0f172a] py-2 px-3 rounded-md font-semibold text-xs"
                  >
                    Cashier Terminal
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 w-full ${mode === 'home' ? '' : 'max-w-7xl mx-auto'}`}>
        {mode === 'home' && (
          <Home
            setMode={setMode}
            setSessionId={setSessionId}
            setCustomerScreen={setCustomerScreen}
          />
        )}
        {mode === 'customer' && (
          <CustomerApp
            sessionId={sessionId}
            setSessionId={setSessionId}
            onLogout={handleLogout}
            cart={cart}
            setCart={setCart}
            screen={customerScreen}
            setScreen={setCustomerScreen}
          />
        )}
        {mode === 'cashier' && <CashierDashboard />}
      </main>
    </div>
  );
}
