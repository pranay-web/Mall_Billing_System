import { useState, useEffect } from 'react';
import { ShoppingBag, ScanLine, ShoppingCart, Trash2 } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function CustomerView() {
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId'));
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState({ items: [], summary: { subtotal: 0, total_gst: 0, final_total: 0 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (sessionId) fetchCart();
  }, [sessionId]);

  const startSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
      const data = await res.json();
      setSessionId(data.session_id);
      localStorage.setItem('sessionId', data.session_id);
    } catch (err) {
      setError('Failed to start session');
    }
  };

  const fetchCart = async () => {
    try {
      const res = await fetch(`${API_BASE}/cart/${sessionId}`);
      const data = await res.json();
      setCart(data);
    } catch (err) {
      setError('Failed to fetch cart');
    }
  };

  const scanProduct = async (e) => {
    e.preventDefault();
    if (!barcode) return;
    setLoading(true);
    setError(null);
    try {
      // Add to cart directly
      const res = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, barcode, quantity: 1 })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error);
      }
      setBarcode('');
      fetchCart();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
        <ShoppingBag size={48} style={{ color: 'var(--accent)', marginBottom: '20px' }} />
        <h2>Welcome to Unified Checkout</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '16px 0' }}>Start a shopping session to begin adding products from any showroom.</p>
        <button onClick={startSession}>Start Shopping Session</button>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="glass-panel">
        <h3><ScanLine style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} /> Scan Product</h3>
        <form onSubmit={scanProduct} style={{ marginTop: '20px' }}>
          <div className="input-group">
            <label>Barcode ID</label>
            <input 
              type="text" 
              placeholder="e.g. 1001, 2002" 
              value={barcode} 
              onChange={e => setBarcode(e.target.value)} 
            />
            <small style={{ color: 'var(--text-secondary)' }}>Available: 1001 (Shirt), 2001 (Charger), 3001 (Chocolate)</small>
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Adding...' : 'Add to Cart'}
          </button>
          {error && <p style={{ color: 'var(--danger)', marginTop: '12px' }}>{error}</p>}
        </form>
      </div>

      <div className="glass-panel" style={{ gridColumn: 'span 2' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><ShoppingCart style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} /> Unified Cart</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Session: {sessionId.substring(0, 8)}...</span>
        </div>
        
        {cart.items.length === 0 ? (
          <p style={{ marginTop: '20px', color: 'var(--text-secondary)' }}>Your cart is empty.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Showroom</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>GST</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.items.map(item => (
                  <tr key={item.cart_id}>
                    <td>{item.product_name}</td>
                    <td>{item.showroom_name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{item.unit_price}</td>
                    <td>₹{item.gst_amount} ({item.gst_rate}%)</td>
                    <td>₹{(item.unit_price * item.quantity) + item.gst_amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <div>Subtotal: ₹{cart.summary.subtotal}</div>
              <div>Total GST: ₹{cart.summary.total_gst}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)' }}>Final Amount: ₹{cart.summary.final_total}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
