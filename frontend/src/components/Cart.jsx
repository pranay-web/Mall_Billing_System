// frontend/src/components/Cart.jsx
import { useState, useEffect } from 'react';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { API_BASE } from '../config';

export default function Cart({ cart, sessionId, onCartUpdate, onProceedCheckout }) {
  const [cartData, setCartData] = useState({
    items: cart || [],
    subtotal: 0,
    totalGST: 0,
    finalTotal: 0,
  });

  // Fetch cart data from server
  useEffect(() => {
    if (sessionId) {
      fetchCart();
    }
  }, [sessionId]);

  const fetchCart = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cart/${sessionId}`);
      const data = await response.json();
      setCartData(data);
      if (onCartUpdate) {
        onCartUpdate(data.items);
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  const handleUpdateQuantity = async (itemId, newQuantity) => {
    try {
      if (newQuantity <= 0) {
        await fetch(`${API_BASE}/api/cart/${sessionId}/items/${itemId}`, {
          method: 'DELETE',
        });
      } else {
        await fetch(`${API_BASE}/api/cart/${sessionId}/items/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: newQuantity }),
        });
      }
      fetchCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await fetch(`${API_BASE}/api/cart/${sessionId}/items/${itemId}`, {
        method: 'DELETE',
      });
      fetchCart();
    } catch (error) {
      console.error('Error removing item:', error);
    }
  };

  if (!cartData.items || cartData.items.length === 0) {
    return (
      <div className="max-w-md mx-auto py-12">
        <div className="bg-white border border-[#e2e8f0] rounded p-8 text-center">
          <div className="w-12 h-12 rounded bg-[#f1f5f9] border border-[#e2e8f0] flex items-center justify-center mx-auto mb-3 text-[#64748b]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-[#1e293b] mb-1">Shopping Bag is Empty</h3>
          <p className="text-sm text-[#64748b]">
            Scan barcodes across mall showrooms or select items from the catalog.
          </p>
        </div>
      </div>
    );
  }

  const totalItemCount = cartData.items.reduce((sum, i) => sum + (i.quantity || 1), 0);

  return (
    <div className="max-w-6xl mx-auto py-4">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1e293b] tracking-tight">Shopping Bag</h2>
          <p className="text-sm text-[#64748b] mt-0.5">Consolidated items from all mall showrooms</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
          {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* 2-Column Minimal Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Clean Product List */}
        <div className="lg:col-span-7 space-y-3">
          {cartData.items.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-[#e2e8f0] rounded p-5 flex gap-4 items-center justify-between"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[#1e293b] text-base truncate">{item.name}</h4>
                  <span className="text-[11px] font-semibold text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded">
                    GST {item.gst}%
                  </span>
                </div>
                <p className="text-xs text-[#64748b] mt-1">
                  {item.showroom} • <span className="font-mono text-[#1e293b] font-semibold">₹{item.price}</span> per unit
                </p>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                {/* Quantity Controls */}
                <div className="flex items-center border border-[#e2e8f0] rounded bg-[#f8fafc]">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-[#64748b] hover:text-[#1e293b] hover:bg-[#e2e8f0] transition cursor-pointer"
                    title="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <span className="font-mono font-bold text-[#1e293b] text-xs px-2.5 min-w-[28px] text-center">
                    {item.quantity}
                  </span>

                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-[#64748b] hover:text-[#1e293b] hover:bg-[#e2e8f0] transition cursor-pointer"
                    title="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Total Price */}
                <div className="text-right min-w-[70px]">
                  <span className="font-mono font-bold text-[#1e293b] text-base block">
                    ₹{(item.price * item.quantity * (1 + item.gst / 100)).toFixed(2)}
                  </span>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="text-[#94a3b8] hover:text-[#ef4444] p-1.5 transition cursor-pointer"
                  title="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Side: Clean Order Summary Box with Blue Left Border */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded p-6 space-y-5">
            <h3 className="text-lg font-bold text-[#1e293b] tracking-tight pb-3 border-b border-[#e2e8f0]">
              Order Summary
            </h3>

            {/* Subtotal */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#64748b]">Subtotal ({totalItemCount} items)</span>
              <span className="font-semibold text-[#1e293b] font-mono">₹{cartData.subtotal.toFixed(2)}</span>
            </div>

            {/* GST Breakdown (Smaller Text) */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded p-3 space-y-1.5">
              <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider block">
                GST Tax Breakdown
              </span>
              {getGSTBreakdown(cartData.items).map((tax, idx) => (
                <div key={idx} className="flex justify-between text-xs text-[#64748b]">
                  <span>
                    {tax.category.charAt(0).toUpperCase() + tax.category.slice(1)} ({tax.rate}%)
                  </span>
                  <span className="font-mono text-[#1e293b]">₹{tax.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Total GST */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-[#64748b]">Total GST</span>
              <span className="font-semibold text-[#64748b] font-mono">₹{cartData.totalGST.toFixed(2)}</span>
            </div>

            {/* Total in Bold Blue */}
            <div className="flex justify-between items-baseline pt-4 border-t border-[#e2e8f0]">
              <div>
                <span className="text-base font-bold text-[#1e293b] block">Total Payable</span>
                <span className="text-xs text-[#64748b]">Includes showroom taxes</span>
              </div>
              <span className="text-2xl sm:text-3xl font-extrabold text-[#0066ff] font-mono">
                ₹{cartData.finalTotal.toFixed(2)}
              </span>
            </div>

            {/* Checkout Button: Bold Blue Professional */}
            <button
              onClick={onProceedCheckout}
              className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3.5 px-6 rounded text-sm transition cursor-pointer text-center"
            >
              Proceed to Checkout
            </button>

            <p className="text-[11px] text-[#94a3b8] text-center">
              Official centralized invoice with input tax credit support issued at checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getGSTBreakdown(items) {
  const breakdown = {};

  items.forEach((item) => {
    const key = `${item.category}-${item.gst}`;
    if (!breakdown[key]) {
      breakdown[key] = {
        category: item.category,
        rate: item.gst,
        amount: 0,
      };
    }
    breakdown[key].amount += item.price * item.quantity * (item.gst / 100);
  });

  return Object.values(breakdown);
}
