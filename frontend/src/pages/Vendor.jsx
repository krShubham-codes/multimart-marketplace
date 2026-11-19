import { useEffect, useState } from 'react';
import api, { imageUrl, errorMessage } from '../api';
import { useAuth } from '../AuthContext.jsx';

const emptyForm = { name: '', description: '', price: '', stock: '', category: '', image: '' };

export default function Vendor() {
  const { user, updateUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');

  const loadAll = async () => {
    try {
      // refresh our own user data (admin may have approved us)
      const me = await api.get('/auth/me');
      updateUser(me.data.user);
      const [p, o] = await Promise.all([api.get('/products/mine'), api.get('/orders/vendor')]);
      setProducts(p.data);
      setOrders(o.data);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  useEffect(() => { loadAll(); }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const uploadImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = new FormData();
    data.append('image', file);
    try {
      const res = await api.post('/products/upload', data);
      setForm({ ...form, image: res.data.url });
      setMessage('Image uploaded.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const addProduct = async (e) => {
    e.preventDefault();
    try {
      await api.post('/products', form);
      setForm(emptyForm);
      setMessage('Product added.');
      loadAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  // quick edit for price and stock using prompt boxes (keeps the UI simple)
  const editProduct = async (p) => {
    const price = prompt('New price', p.price);
    if (price === null) return;
    const stock = prompt('New stock', p.stock);
    if (stock === null) return;
    try {
      await api.put('/products/' + p._id, { price: Number(price), stock: Number(stock) });
      loadAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await api.delete('/products/' + id);
      loadAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const changeStatus = async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      loadAll();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const totalEarning = orders.reduce((sum, o) => sum + o.earning, 0);

  if (!user.approved) {
    return (
      <div className="panel">
        <h2>Waiting for approval</h2>
        <p>Your shop <strong>{user.shopName}</strong> has been registered. You can add products once the admin approves it.</p>
        <button onClick={loadAll}>Check again</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{user.shopName} — dashboard</h2>
      {message && <p className="notice">{message}</p>}
      <p>Total earnings (after platform commission): <strong>₹{totalEarning}</strong></p>

      <form className="panel" onSubmit={addProduct}>
        <h3>Add a product</h3>
        <input name="name" placeholder="Product name" value={form.name} onChange={handleChange} required />
        <textarea name="description" placeholder="Description" value={form.description} onChange={handleChange} />
        <div className="row left">
          <input name="price" type="number" placeholder="Price (₹)" value={form.price} onChange={handleChange} required />
          <input name="stock" type="number" placeholder="Stock" value={form.stock} onChange={handleChange} required />
          <input name="category" placeholder="Category" value={form.category} onChange={handleChange} />
        </div>
        <label>Product image</label>
        <input type="file" accept="image/*" onChange={uploadImage} />
        {form.image && <img src={imageUrl(form.image)} alt="preview" style={{ width: 120 }} />}
        <button type="submit">Add product</button>
      </form>

      <h3>My products</h3>
      {products.length === 0 && <p className="muted">You have not added any products yet.</p>}
      {products.map((p) => (
        <div className="cart-row" key={p._id}>
          <img src={imageUrl(p.image)} alt={p.name} />
          <div className="grow">
            <strong>{p.name}</strong>
            <p className="muted small">₹{p.price} · stock {p.stock} · {p.category}</p>
          </div>
          <button onClick={() => editProduct(p)}>Edit price/stock</button>
          <button className="danger" onClick={() => deleteProduct(p._id)}>Delete</button>
        </div>
      ))}

      <h3>Orders for my products</h3>
      {orders.length === 0 && <p className="muted">No paid orders yet.</p>}
      {orders.map((o) => (
        <div className="panel" key={o._id}>
          <div className="row">
            <strong>Order #{o._id.slice(-6)} — {o.customer?.name}</strong>
            <select value={o.status} onChange={(e) => changeStatus(o._id, e.target.value)}>
              {['placed', 'packed', 'shipped', 'delivered'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {o.items.map((i, idx) => <p key={idx} className="small">{i.name} × {i.qty}</p>)}
          <p className="small muted">Ship to: {o.address}</p>
          <p className="small">Your earning: <strong>₹{o.earning}</strong></p>
        </div>
      ))}
    </div>
  );
}
