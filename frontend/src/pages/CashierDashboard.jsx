// frontend/src/pages/CashierDashboard.jsx
import { useState } from 'react';
import { Search, CheckCircle, AlertCircle } from 'lucide-react';
import { API_BASE } from '../config';

export default function CashierDashboard() {
  const [sessionId, setSessionId] = useState('');
  const [cartData, setCartData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleRetrieveCart = async () => {
    if (!sessionId.trim()) {
      setError('Please enter a valid Customer Session ID');
      return;
    }

    setLoading(true);
    setError('');
    setVerified(false);

    try {
      const response = await fetch(`${API_BASE}/api/sessions/${sessionId}`);

      if (!response.ok) {
        throw new Error('Customer session not found');
      }

      const session = await response.json();

      if (session.items.length === 0) {
        throw new Error('Customer shopping cart is empty');
      }

      // Fetch full cart data
      const cartResponse = await fetch(`${API_BASE}/api/cart/${sessionId}`);
      const data = await cartResponse.json();

      setCartData(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to retrieve session data');
      setCartData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCart = () => {
    setVerified(true);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 text-[#0f172a]">
      {/* Header */}
      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#0066ff] block mb-1">
          FlashCart POS Desk
        </span>
        <h2 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">Cart Audit & Settlement</h2>
        <p className="text-xs text-[#475569] mt-1 leading-relaxed">
          Lookup customer session, audit physical merchandise, and approve centralized tax invoice.
        </p>
      </div>

      {/* Lookup Box */}
      <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded-md p-6 sm:p-8 space-y-4 mb-8 shadow-xs">
        <label className="text-xs font-bold uppercase tracking-wider text-[#475569] block">
          Enter Customer Session ID
        </label>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            placeholder="Paste customer Session ID..."
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value.trim())}
            onKeyPress={(e) => e.key === 'Enter' && handleRetrieveCart()}
            className="flex-1 px-4 py-3 bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#0066ff] rounded-md text-[#0f172a] placeholder-[#94a3b8] font-mono text-sm focus:outline-none"
          />
          <button
            onClick={handleRetrieveCart}
            disabled={loading}
            className="bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3 px-6 rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
          >
            <Search className="w-3.5 h-3.5" />
            <span>{loading ? 'Retrieving...' : 'Audit Cart'}</span>
          </button>
        </div>

        {error && (
          <div className="bg-[#fef2f2] border border-[#fecaca] text-red-700 rounded-md p-3 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Cart Details */}
      {cartData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Items to Audit */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-[#e2e8f0]">
              <h3 className="text-base font-bold text-[#0f172a] tracking-tight">Merchandise to Verify</h3>
              <span className="text-xs font-mono font-semibold text-[#475569]">
                {cartData.itemCount} items
              </span>
            </div>

            <div className="space-y-2.5">
              {cartData.items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-[#e2e8f0] rounded-md p-4 flex justify-between items-center shadow-2xs"
                >
                  <div>
                    <h4 className="font-bold text-[#0f172a] text-sm">{item.name}</h4>
                    <p className="text-xs text-[#475569] mt-0.5">
                      {item.showroom} • Barcode: <span className="font-mono text-[#0f172a]">{item.barcode}</span>
                    </p>
                    <p className="text-[11px] text-[#64748b] mt-1">
                      Qty: <span className="font-bold font-mono text-[#0f172a]">{item.quantity}</span> • Rate: ₹{item.price} • GST {item.gst}%
                    </p>
                  </div>

                  <span className="font-mono font-bold text-[#0f172a] text-sm">
                    ₹{(item.price * item.quantity * (1 + item.gst / 100)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Summary Box with Blue Left Border */}
          <div className="lg:col-span-5 sticky top-24 space-y-4">
            <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded-md p-6 space-y-4 shadow-xs">
              <h3 className="text-base font-bold text-[#0f172a] pb-2 border-b border-[#e2e8f0] tracking-tight">
                Financial Settlement
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-[#475569]">
                  <span>Subtotal</span>
                  <span className="font-mono text-[#0f172a] font-medium">₹{cartData.subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-[#475569]">
                  <span>Consolidated GST</span>
                  <span className="font-mono text-[#0f172a] font-medium">₹{cartData.totalGST.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-baseline pt-3 border-t border-[#e2e8f0]">
                  <span className="text-sm font-bold text-[#0f172a]">Settlement Total</span>
                  <span className="text-2xl font-extrabold text-[#0066ff] font-mono">
                    ₹{cartData.finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {!verified ? (
                  <button
                    onClick={handleVerifyCart}
                    className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3.5 px-4 rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve & Authorize Cart</span>
                  </button>
                ) : (
                  <div className="bg-[#ecfdf5] border border-[#a7f3d0] text-emerald-800 rounded-md p-3 flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Cart Verified & Approved for Mall Exit.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Guide */}
      {!cartData && !error && (
        <div className="bg-white border border-[#e2e8f0] rounded-md p-6 text-xs text-[#475569] space-y-2 shadow-xs">
          <p className="font-bold text-[#0f172a]">FlashCart Cashier Verification Guide:</p>
          <ol className="list-decimal ml-4 space-y-1 leading-relaxed">
            <li>Customer presents their active Session ID upon arrival at the central desk.</li>
            <li>Input the Session ID to pull the consolidated item list across all showrooms.</li>
            <li>Verify physical contents and authorize departure.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
