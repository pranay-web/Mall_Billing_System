import { useState } from 'react';
import { CreditCard, Search } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function CheckoutView() {
  const [sessionId, setSessionId] = useState('');
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const fetchCart = async (e) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const res = await fetch(`${API_BASE}/cart/${sessionId}`);
      if (!res.ok) throw new Error('Failed to fetch cart');
      const data = await res.json();
      setCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, payment_method: 'Card' })
      });
      if (!res.ok) throw new Error('Checkout failed');
      const data = await res.json();
      setReceipt(data);
      setCart(null); // Clear cart view on success
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="glass-panel" style={{ gridColumn: 'span 1' }}>
        <h3><Search style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} /> Cashier Terminal</h3>
        <form onSubmit={fetchCart} style={{ marginTop: '20px' }}>
          <div className="input-group">
            <label>Customer Session ID</label>
            <input 
              type="text" 
              placeholder="Enter Session ID..." 
              value={sessionId} 
              onChange={e => setSessionId(e.target.value)} 
            />
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Loading...' : 'Fetch Cart'}
          </button>
          {error && <p style={{ color: 'var(--danger)', marginTop: '12px' }}>{error}</p>}
        </form>
      </div>

      <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
        <h3>Checkout Review</h3>
        
        {receipt && (
          <div className="animate-fade-in" style={{ padding: '24px', background: 'var(--success)', color: 'white', borderRadius: '8px', marginTop: '20px' }}>
            <h2 style={{ marginBottom: '12px' }}>Payment Successful!</h2>
            <p><strong>Transaction ID:</strong> {receipt.transaction_id}</p>
            <p><strong>Total Paid:</strong> ₹{receipt.total_amount}</p>
            <p><strong>Method:</strong> Card</p>
            <p style={{ marginTop: '16px' }}>Receipt has been generated and sent to customer digitally.</p>
          </div>
        )}

        {cart && cart.items.length > 0 && (
          <div className="animate-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Showroom</th>
                  <th>Qty</th>
                  <th>Total Price (inc. GST)</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map(item => (
                  <tr key={item.cart_id}>
                    <td>{item.product_name}</td>
                    <td>{item.showroom_name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{(item.unit_price * item.quantity) + item.gst_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                Total to Pay: <span style={{ color: 'var(--accent)' }}>₹{cart.summary.final_total}</span>
              </div>
              <button onClick={handleCheckout} className="success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} /> Complete Payment
              </button>
            </div>
          </div>
        )}

        {cart && cart.items.length === 0 && (
          <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>This session's cart is empty.</p>
        )}
      </div>
    </div>
  );
}
