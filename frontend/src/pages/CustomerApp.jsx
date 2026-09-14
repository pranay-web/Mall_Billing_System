// frontend/src/pages/CustomerApp.jsx
import { useState, useEffect } from 'react';
import { Camera, Search, ShoppingBag, CheckCircle, Printer, Share2, Home } from 'lucide-react';
import Scanner from '../components/Scanner';
import Cart from '../components/Cart';
import Checkout from '../components/Checkout';
import { API_BASE } from '../config';

export default function CustomerApp({
  sessionId,
  setSessionId,
  onLogout,
  cart: parentCart,
  setCart: parentSetCart,
  screen: parentScreen,
  setScreen: parentSetScreen,
}) {
  const [internalScreen, setInternalScreen] = useState('scanner'); // 'scanner', 'search', 'cart', 'checkout', 'receipt'
  const [internalCart, setInternalCart] = useState([]);
  const [transaction, setTransaction] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [products, setProducts] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  const screen = parentScreen !== undefined ? parentScreen : internalScreen;
  const setScreen = parentSetScreen || setInternalScreen;
  const cart = parentCart !== undefined ? parentCart : internalCart;
  const setCart = parentSetCart || setInternalCart;

  // Fetch initial cart on mount or sessionId change
  useEffect(() => {
    if (sessionId) {
      fetch(`${API_BASE}/api/cart/${sessionId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.items) {
            setCart(data.items);
          }
        })
        .catch((err) => console.error('Error fetching cart:', err));
    }
  }, [sessionId]);

  // Fetch all products for search
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/products`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleAddProduct = async (barcode) => {
    try {
      const response = await fetch(`${API_BASE}/api/cart/${sessionId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, quantity: 1 }),
      });

      if (response.ok) {
        // Fetch updated cart
        const cartResponse = await fetch(`${API_BASE}/api/cart/${sessionId}`);
        const cartData = await cartResponse.json();
        setCart(cartData.items);

        // Show confirmation toast
        const product = products.find((p) => p.barcode === barcode);
        showToast(`✓ Added ${product?.name || barcode} to Bag`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(`✕ ${errorData.error || 'Product not recognized'}`);
      }
    } catch (error) {
      console.error('Error adding product:', error);
      showToast('✕ Network error adding product');
    }
  };

  const handleSearch = (product) => {
    handleAddProduct(product.barcode);
    setShowSearch(false);
  };

  const handleCheckout = async (paymentMethod) => {
    try {
      const response = await fetch(`${API_BASE}/api/checkout/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          paymentMethod,
          discount: 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTransaction(data);
        setCart([]);
        setScreen('receipt');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Payment authorization failed!');
    }
  };

  if (screen === 'receipt' && transaction) {
    return <Receipt transaction={transaction} sessionId={sessionId} onBackHome={onLogout} />;
  }

  const totalCartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className="pb-24 pt-4 px-4 sm:px-6 lg:px-8 text-[#0f172a] min-h-[calc(100vh-80px)]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] text-[#0f172a] px-4 py-2.5 rounded-md shadow-sm flex items-center gap-2">
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Session Bar with Minimal Tabs */}
      <div className="bg-white border border-[#e2e8f0] rounded-md p-4 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xs">
        <div>
          <span className="text-[11px] text-[#64748b] uppercase tracking-wider font-semibold block">Active Session ID</span>
          <span className="font-mono font-bold text-[#0f172a] text-sm">{sessionId}</span>
        </div>

        {/* Minimal Flat Tabs */}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setScreen('scanner');
              fetchProducts();
              setShowSearch(false);
            }}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-md font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              screen === 'scanner' && !showSearch
                ? 'bg-[#0066ff] text-white shadow-xs'
                : 'bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan</span>
          </button>

          <button
            onClick={() => {
              setScreen('search');
              fetchProducts();
              setShowSearch(true);
            }}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-md font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              screen === 'search' || showSearch
                ? 'bg-[#0066ff] text-white shadow-xs'
                : 'bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Catalog</span>
          </button>

          <button
            onClick={() => {
              setScreen('cart');
              setShowSearch(false);
            }}
            className={`flex-1 sm:flex-initial py-2 px-4 rounded-md font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
              screen === 'cart'
                ? 'bg-[#0066ff] text-white shadow-xs'
                : 'bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({totalCartCount})</span>
          </button>
        </div>
      </div>

      {/* Screen Views */}
      <div>
        {screen === 'scanner' && !showSearch && (
          <Scanner
            sessionId={sessionId}
            onProductScanned={(barcode) => handleAddProduct(barcode)}
          />
        )}

        {(screen === 'search' || showSearch) && (
          <ProductSearch
            products={products}
            onSelect={handleSearch}
            onClose={() => {
              setShowSearch(false);
              if (screen === 'search') setScreen('scanner');
            }}
          />
        )}

        {screen === 'cart' && !showSearch && (
          <Cart
            cart={cart}
            sessionId={sessionId}
            onCartUpdate={(items) => setCart(items)}
            onProceedCheckout={() => setScreen('checkout')}
          />
        )}

        {screen === 'checkout' && !showSearch && (
          <Checkout
            cart={cart}
            onPaymentComplete={(method) => handleCheckout(method)}
            onCancel={() => setScreen('cart')}
          />
        )}
      </div>
    </div>
  );
}

// Minimal Product Search in Flat Light Theme
function ProductSearch({ products, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(products.map((p) => p.category))];

  return (
    <div className="max-w-3xl mx-auto bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded-md p-6 sm:p-8 space-y-5 shadow-xs">
      <div className="flex justify-between items-center pb-3 border-b border-[#e2e8f0]">
        <div>
          <h3 className="text-xl font-bold text-[#0f172a] tracking-tight">FlashCart Catalog</h3>
          <p className="text-xs text-[#475569]">Select items to add to your unified session</p>
        </div>
        <button
          onClick={onClose}
          className="text-[#64748b] hover:text-[#0f172a] font-bold p-1 transition text-lg cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#94a3b8]" />
        <input
          type="text"
          placeholder="Search items by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#0066ff] rounded-md text-[#0f172a] placeholder-[#94a3b8] text-xs focus:outline-none"
        />
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              category === cat
                ? 'bg-[#0066ff] text-white shadow-xs'
                : 'bg-white border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]'
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Product List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filtered.length > 0 ? (
          filtered.map((product) => (
            <div
              key={product.id}
              onClick={() => onSelect(product)}
              className="w-full bg-white border border-[#e2e8f0] hover:border-[#0066ff] p-3.5 rounded-md transition text-left flex justify-between items-center cursor-pointer group shadow-2xs"
            >
              <div>
                <p className="font-bold text-[#0f172a] text-sm group-hover:text-[#0066ff] transition-colors">
                  {product.name}
                </p>
                <p className="text-xs text-[#475569] mt-0.5">
                  <span className="font-mono font-bold text-[#0f172a]">₹{product.price}</span> • {product.showroom} •{' '}
                  <span className="text-[#64748b]">GST {product.gst}%</span>
                </p>
              </div>
              <span className="text-xs font-bold text-[#0066ff] px-3 py-1 bg-[#eff6ff] rounded-md border border-[#0066ff]/20">
                + Add
              </span>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-[#94a3b8]">
            <p className="text-xs">No products found matching &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Receipt Page: Center Layout, Minimal Green Checkmark, Order Summary Box with Blue Left Border
function Receipt({ transaction, sessionId, onBackHome }) {
  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const text = `
FLASHCART OFFICIAL TAX INVOICE
Transaction: ${transaction.transactionId}
Session ID: ${sessionId}
Total: ₹${transaction.finalTotal}
Payment: ${transaction.paymentMethod}
`;
    if (navigator.share) {
      navigator.share({ title: 'FlashCart Receipt', text });
    } else {
      alert(text);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 text-center">
      <div className="bg-white border border-[#e2e8f0] rounded-md p-8 space-y-6 shadow-xs">
        {/* Large Minimal Green Checkmark */}
        <div className="w-14 h-14 bg-[#ecfdf5] border border-[#a7f3d0] rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-[#0f172a] tracking-tight">Payment Successful</h2>
          <p className="text-xs text-[#475569]">Your transaction has been authorized and cleared by FlashCart.</p>
        </div>

        {/* Receipt Details in Clean Format */}
        <div className="grid grid-cols-2 gap-3 text-xs bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-4 text-left">
          <div>
            <span className="text-[11px] text-[#64748b] uppercase font-semibold block">Invoice ID</span>
            <span className="font-mono font-bold text-[#0f172a]">{transaction.transactionId}</span>
          </div>
          <div>
            <span className="text-[11px] text-[#64748b] uppercase font-semibold block">Session Ref</span>
            <span className="font-mono text-[#0f172a]">{transaction.sessionId}</span>
          </div>
          <div>
            <span className="text-[11px] text-[#64748b] uppercase font-semibold block">Method</span>
            <span className="font-bold text-[#0f172a] uppercase">{transaction.paymentMethod}</span>
          </div>
          <div>
            <span className="text-[11px] text-[#64748b] uppercase font-semibold block">Status</span>
            <span className="font-bold text-emerald-600 uppercase">Paid & Cleared</span>
          </div>
        </div>

        {/* Order Summary in Summary Box with Blue Left Border */}
        <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded-md p-5 text-left space-y-3">
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#64748b]">
            Purchased Items ({transaction.items.length})
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {transaction.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-[#e2e8f0]">
                <span className="text-[#0f172a]">
                  <span className="font-mono text-[#64748b]">{item.quantity}x</span> {item.name}
                </span>
                <span className="font-mono font-medium text-[#0f172a]">
                  ₹{(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#e2e8f0] space-y-1 text-xs">
            <div className="flex justify-between text-[#64748b]">
              <span>Subtotal</span>
              <span className="font-mono text-[#0f172a]">₹{transaction.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[#64748b]">
              <span>Total GST</span>
              <span className="font-mono text-[#0f172a]">₹{transaction.totalGST.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-[#e2e8f0]">
              <span className="text-sm font-bold text-[#0f172a]">Total Paid</span>
              <span className="text-xl font-extrabold text-[#0066ff] font-mono">
                ₹{transaction.finalTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Buttons: Print (Secondary), Share (Secondary), Home (Primary Blue) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-[#eff6ff] py-3 px-4 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          <button
            onClick={handleShare}
            className="bg-white border-2 border-[#0066ff] text-[#0066ff] hover:bg-[#eff6ff] py-3 px-4 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>

          <button
            onClick={onBackHome}
            className="bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3 px-4 rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
