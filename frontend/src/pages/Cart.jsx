import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { imageUrl, errorMessage } from '../api';

// Loads the Razorpay checkout script only when needed
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [address, setAddress] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCart = async () => {
    const { data } = await api.get('/cart');
    setCart(data);
  };

  useEffect(() => { loadCart(); }, []);

  const changeQty = async (productId, qty) => {
    try {
      await api.put('/cart/update', { productId, qty });
      setMessage('');
      loadCart();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const placeOrder = async () => {
    setMessage('');
    setBusy(true);
    try {
      // 1. create the order on our server
      const { data: order } = await api.post('/orders', { address, couponCode });
      // 2. ask the server how to pay
      const { data: pay } = await api.post('/payments/create', { orderId: order._id });

      if (pay.mode === 'mock') {
        // no Razorpay keys set: demo payment
        await api.post('/payments/mock-confirm', { orderId: order._id });
        navigate('/orders');
        return;
      }

      // 3. open Razorpay checkout (test mode)
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Could not load Razorpay');
      const rzp = new window.Razorpay({
        key: pay.key,
        amount: pay.amount,
        currency: 'INR',
        name: 'MultiMart',
        order_id: pay.razorpayOrderId,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', { orderId: order._id, ...response });
            navigate('/orders');
          } catch (err) {
            setMessage(errorMessage(err));
          }
        },
      });
      rzp.open();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (cart.items.length === 0) return <p className="muted">Your cart is empty. Add some products from the home page.</p>;

  return (
    <div>
      <h2>Your cart</h2>
      {cart.items.map(({ product, qty }) => (
        <div className="cart-row" key={product._id}>
          <img src={imageUrl(product.image)} alt={product.name} />
          <div className="grow">
            <strong>{product.name}</strong>
            <p className="muted small">₹{product.price} each</p>
          </div>
          <input type="number" min="0" value={qty} style={{ width: 70 }} onChange={(e) => changeQty(product._id, e.target.value)} />
          <strong>₹{product.price * qty}</strong>
          <button className="link-btn" onClick={() => changeQty(product._id, 0)}>Remove</button>
        </div>
      ))}

      <h3>Subtotal: ₹{cart.total}</h3>

      <div className="panel">
        <label>Delivery address</label>
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no, street, city, pincode" />
        <label>Coupon code (optional)</label>
        <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="e.g. WELCOME10" />
        {message && <p className="error">{message}</p>}
        <button onClick={placeOrder} disabled={busy}>{busy ? 'Please wait...' : 'Place order & pay'}</button>
      </div>
    </div>
  );
}
