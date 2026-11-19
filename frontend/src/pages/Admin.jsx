import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [coupon, setCoupon] = useState({ code: '', percent: '' });
  const [message, setMessage] = useState('');

  const loadAll = async () => {
    try {
      const [s, v, c] = await Promise.all([api.get('/admin/stats'), api.get('/admin/vendors'), api.get('/admin/coupons')]);
      setStats(s.data);
      setVendors(v.data);
      setCoupons(c.data);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  useEffect(() => { loadAll(); }, []);

  const toggleVendor = async (vendor) => {
    await api.put(`/admin/vendors/${vendor._id}/approve`, { approved: !vendor.approved });
    loadAll();
  };

  const addCoupon = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/coupons', coupon);
      setCoupon({ code: '', percent: '' });
      setMessage('Coupon created.');
      loadAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const deleteCoupon = async (id) => {
    await api.delete('/admin/coupons/' + id);
    loadAll();
  };

  return (
    <div>
      <h2>Admin analytics</h2>
      {message && <p className="notice">{message}</p>}

      {stats && (
        <>
          <div className="stats">
            <div className="stat"><span>Revenue</span><strong>₹{stats.revenue}</strong></div>
            <div className="stat"><span>Platform commission</span><strong>₹{stats.commission}</strong></div>
            <div className="stat"><span>Paid orders</span><strong>{stats.orders}</strong></div>
            <div className="stat"><span>Customers</span><strong>{stats.customers}</strong></div>
            <div className="stat"><span>Vendors</span><strong>{stats.vendors}</strong></div>
            <div className="stat"><span>Products</span><strong>{stats.products}</strong></div>
          </div>

          <div className="two-col">
            <div className="panel">
              <h4>Orders by status</h4>
              {stats.byStatus.length === 0 && <p className="muted small">No orders yet.</p>}
              {stats.byStatus.map((s) => <p key={s._id} className="small">{s._id}: {s.count}</p>)}
            </div>
            <div className="panel">
              <h4>Top selling products</h4>
              {stats.topProducts.length === 0 && <p className="muted small">No sales yet.</p>}
              {stats.topProducts.map((p) => <p key={p._id} className="small">{p._id} — {p.sold} sold</p>)}
            </div>
          </div>
        </>
      )}

      <h3>Vendors</h3>
      {vendors.length === 0 && <p className="muted">No vendors have registered yet.</p>}
      {vendors.map((v) => (
        <div className="cart-row" key={v._id}>
          <div className="grow">
            <strong>{v.shopName}</strong>
            <p className="muted small">{v.name} · {v.email}</p>
          </div>
          <span className={v.approved ? 'tag ok' : 'tag'}>{v.approved ? 'Approved' : 'Pending'}</span>
          <button onClick={() => toggleVendor(v)}>{v.approved ? 'Revoke' : 'Approve'}</button>
        </div>
      ))}

      <h3>Coupons</h3>
      <form className="row left" onSubmit={addCoupon}>
        <input placeholder="CODE" value={coupon.code} onChange={(e) => setCoupon({ ...coupon, code: e.target.value })} required />
        <input type="number" placeholder="% off" min="1" max="90" value={coupon.percent} onChange={(e) => setCoupon({ ...coupon, percent: e.target.value })} required />
        <button type="submit">Create coupon</button>
      </form>
      {coupons.map((c) => (
        <div className="cart-row" key={c._id}>
          <div className="grow"><strong>{c.code}</strong> — {c.percent}% off</div>
          <button className="danger" onClick={() => deleteCoupon(c._id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
