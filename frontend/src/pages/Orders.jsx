import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';

const STEPS = ['placed', 'packed', 'shipped', 'delivered'];

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/orders/mine').then((res) => setOrders(res.data)).catch((err) => setMessage(errorMessage(err)));
  }, []);

  // the invoice route needs the token, so we download it as a blob
  const downloadInvoice = async (id) => {
    try {
      const res = await api.get(`/orders/${id}/invoice`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setMessage('Could not download invoice');
    }
  };

  return (
    <div>
      <h2>My orders</h2>
      {message && <p className="error">{message}</p>}
      {orders.length === 0 && <p className="muted">You have not placed any orders yet.</p>}

      {orders.map((o) => (
        <div className="panel" key={o._id}>
          <div className="row">
            <strong>Order #{o._id.slice(-6)}</strong>
            <span className="muted small">{new Date(o.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="steps">
            {STEPS.map((s, i) => (
              <span key={s} className={i <= STEPS.indexOf(o.status) ? 'step done' : 'step'}>{s}</span>
            ))}
          </div>

          {o.items.map((i, idx) => (
            <p key={idx} className="small">{i.name} × {i.qty} — ₹{i.price * i.qty}</p>
          ))}
          {o.discount > 0 && <p className="small">Coupon {o.couponCode}: -₹{o.discount}</p>}
          <div className="row">
            <strong>Total: ₹{o.total}</strong>
            <button onClick={() => downloadInvoice(o._id)}>Download invoice</button>
          </div>
        </div>
      ))}
    </div>
  );
}
