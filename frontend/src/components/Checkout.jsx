// frontend/src/components/Checkout.jsx
import { useState } from 'react';
import { CreditCard, Smartphone, Banknote, ArrowLeft, Check } from 'lucide-react';

export default function Checkout({ cart, onPaymentComplete, onCancel }) {
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalGST = cart.reduce((sum, item) => sum + (item.price * item.quantity * item.gst) / 100, 0);
  const finalTotal = Math.max(0, subtotal + totalGST - discount);

  const handlePayment = async () => {
    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    setLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      onPaymentComplete(paymentMethod);
      setLoading(false);
    }, 1200);
  };

  const paymentMethods = [
    {
      id: 'upi',
      name: 'UPI / QR Code',
      desc: 'Instant payment via Google Pay, PhonePe, Paytm, or BHIM',
      icon: Smartphone,
    },
    {
      id: 'card',
      name: 'Debit or Credit Card',
      desc: 'Visa, Mastercard, RuPay & American Express',
      icon: CreditCard,
    },
    {
      id: 'cash',
      name: 'Cash at Central Desk',
      desc: 'Pay physical cash at central mall cashier before exiting',
      icon: Banknote,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-4">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-[#0066ff] transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Shopping Bag
        </button>
        <span className="text-xs font-semibold text-[#64748b]">
          Unified Mall Checkout
        </span>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Minimal Order Summary with Blue Left Border */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded p-6 space-y-4">
            <h3 className="text-base font-bold text-[#1e293b] pb-3 border-b border-[#e2e8f0]">
              Order Summary
            </h3>

            {/* Items List */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded p-3 max-h-48 overflow-y-auto space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-[#64748b]">
                  <span className="truncate pr-2 text-[#1e293b]">
                    <span className="font-mono text-[#64748b]">{item.quantity}x</span> {item.name}
                  </span>
                  <span className="font-mono text-[#1e293b] font-medium flex-shrink-0">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {cart.length === 0 && <p className="text-xs text-[#64748b] text-center">Cart is empty</p>}
            </div>

            {/* Calculations */}
            <div className="space-y-2 pt-1 text-sm">
              <div className="flex justify-between text-[#64748b]">
                <span>Subtotal</span>
                <span className="font-mono font-medium text-[#1e293b]">₹{subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Consolidated GST</span>
                <span className="font-mono text-[#64748b]">₹{totalGST.toFixed(2)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                  <span>Voucher Discount</span>
                  <span className="font-mono">-₹{discount.toFixed(2)}</span>
                </div>
              )}

              {/* Final Total in Bold Blue */}
              <div className="flex justify-between items-baseline pt-4 border-t border-[#e2e8f0]">
                <div>
                  <span className="text-sm font-bold text-[#1e293b] block">Total Amount</span>
                  <span className="text-[11px] text-[#64748b]">All taxes included</span>
                </div>
                <span className="text-2xl font-extrabold text-[#0066ff] font-mono">
                  ₹{finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Optional Voucher Box */}
          <div className="bg-white border border-[#e2e8f0] rounded p-4 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#64748b] block">
              Promo Code / Voucher
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Discount amount"
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                max={subtotal + totalGST}
                className="flex-1 px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] focus:border-[#0066ff] rounded text-[#1e293b] placeholder-[#94a3b8] text-xs font-mono focus:outline-none"
              />
              <span className="bg-[#f1f5f9] px-3.5 py-2 rounded border border-[#e2e8f0] text-xs font-bold text-[#64748b] flex items-center">
                ₹
              </span>
            </div>
          </div>
        </div>

        {/* Right: Payment Methods with Large Radio Buttons */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#e2e8f0] border-l-4 border-l-[#0066ff] rounded p-6 space-y-5">
            <div>
              <h3 className="text-xl font-bold text-[#1e293b] tracking-tight">Select Payment Method</h3>
              <p className="text-xs text-[#64748b] mt-0.5">
                One payment settles all showrooms across the mall
              </p>
            </div>

            {/* Payment Method Cards */}
            <div className="space-y-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-4 rounded border transition cursor-pointer flex items-center gap-4 ${
                      isSelected
                        ? 'bg-[#eff6ff] border-[#0066ff]'
                        : 'bg-white border-[#e2e8f0] hover:border-[#cbd5e1]'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded flex items-center justify-center border ${
                        isSelected
                          ? 'bg-[#0066ff] text-white border-[#0066ff]'
                          : 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <p className="font-bold text-[#1e293b] text-sm">{method.name}</p>
                      <p className="text-xs text-[#64748b] mt-0.5">{method.desc}</p>
                    </div>

                    {/* Radio Button */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-[#0066ff] bg-[#0066ff]' : 'border-[#cbd5e1]'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pay Button: Large, Bold Blue, Professional */}
            <div className="pt-2">
              <button
                onClick={handlePayment}
                disabled={loading || !paymentMethod}
                className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white font-bold py-3.5 px-6 rounded text-base transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
              >
                {loading ? 'Processing Payment...' : `Pay ₹${finalTotal.toFixed(2)}`}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#94a3b8] pt-2 border-t border-[#e2e8f0]">
              <span>Centralized retail transaction</span>
              <span>Encrypted payment gateway</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
