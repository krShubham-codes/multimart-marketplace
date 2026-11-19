import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { imageUrl, errorMessage } from '../api';
import { useAuth } from '../AuthContext.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [p, r] = await Promise.all([api.get('/products/' + id), api.get('/reviews/' + id)]);
      setProduct(p.data);
      setReviews(r.data);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  useEffect(() => { load(); }, [id]);

  const addToCart = async () => {
    if (user?.role !== 'customer') return setMessage('Please login as a customer to buy.');
    try {
      await api.post('/cart/add', { productId: id, qty });
      setMessage('Added to cart.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post('/reviews/' + id, review);
      setMessage('Thanks for your review!');
      setReview({ rating: 5, comment: '' });
      load();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  if (!product) return <p>{message || 'Loading...'}</p>;

  return (
    <div>
      <div className="detail">
        <img src={imageUrl(product.image)} alt={product.name} />
        <div>
          <h2>{product.name}</h2>
          <p className="muted">Sold by {product.vendor?.shopName || 'a vendor'} · {product.category}</p>
          <p>{product.description}</p>
          <h3>₹{product.price}</h3>
          <p className="muted">
            {product.ratingCount > 0 ? `${product.ratingAvg} ★ from ${product.ratingCount} reviews` : 'No reviews yet'}
            {' · '}{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </p>
          <div className="row left">
            <input type="number" min="1" max={product.stock} value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 70 }} />
            <button onClick={addToCart} disabled={product.stock === 0}>Add to cart</button>
          </div>
          {message && <p className="notice">{message}</p>}
        </div>
      </div>

      <h3>Reviews</h3>
      {reviews.length === 0 && <p className="muted">Nobody has reviewed this product yet.</p>}
      {reviews.map((r) => (
        <div className="review" key={r._id}>
          <strong>{r.user?.name}</strong> — {r.rating} ★
          <p>{r.comment}</p>
        </div>
      ))}

      {user?.role === 'customer' && (
        <form className="panel" onSubmit={submitReview}>
          <h4>Write a review (only for products you bought)</h4>
          <select value={review.rating} onChange={(e) => setReview({ ...review, rating: e.target.value })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
          </select>
          <textarea placeholder="Your comment" value={review.comment} onChange={(e) => setReview({ ...review, comment: e.target.value })} />
          <button type="submit">Submit review</button>
        </form>
      )}
    </div>
  );
}
