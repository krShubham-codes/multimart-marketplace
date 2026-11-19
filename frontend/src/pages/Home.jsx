import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { imageUrl, errorMessage } from '../api';
import { useAuth } from '../AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [message, setMessage] = useState('');

  // filter values
  const [filters, setFilters] = useState({ q: '', category: '', minPrice: '', maxPrice: '', sort: 'newest' });

  const loadProducts = async (pageNumber = 1, activeFilters = filters) => {
   try {
    const { data } = await api.get('/products', { params: { ...activeFilters, page: pageNumber } });
      setProducts(data.products);
      setPage(data.page);
      setPages(data.pages);
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  useEffect(() => {
    api.get('/products/categories').then((res) => setCategories(res.data));
    loadProducts(1);
    // eslint-disable-next-line
  }, []);

  const handleChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts(1);
  };

  const addToCart = async (productId) => {
    if (!user) return setMessage('Please login as a customer to add items to cart.');
    if (user.role !== 'customer') return setMessage('Only customers can buy products.');
    try {
      await api.post('/cart/add', { productId, qty: 1 });
      setMessage('Added to cart.');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <div>
      <form className="filters" onSubmit={handleSearch}>
        <input name="q" placeholder="Search products" value={filters.q} onChange={handleChange} />
        <select name="category" value={filters.category} onChange={handleChange}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input name="minPrice" type="number" placeholder="Min price" value={filters.minPrice} onChange={handleChange} />
        <input name="maxPrice" type="number" placeholder="Max price" value={filters.maxPrice} onChange={handleChange} />
        <select name="sort" value={filters.sort} onChange={handleChange}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
        <button type="submit">Search</button>
      </form>

      {message && <p className="notice">{message}</p>}

      {products.length === 0 ? (
        <p className="muted">No products found. Try a different search.</p>
      ) : (
        <div className="grid">
          {products.map((p) => (
            <div className="card" key={p._id}>
              <Link to={`/product/${p._id}`}>
                <img src={imageUrl(p.image)} alt={p.name} />
              </Link>
              <h3>{p.name}</h3>
              <p className="muted small">{p.category} {p.ratingCount > 0 && `· ${p.ratingAvg} ★ (${p.ratingCount})`}</p>
              <div className="row">
                <strong>₹{p.price}</strong>
                <button onClick={() => addToCart(p._id)} disabled={p.stock === 0}>
                  {p.stock === 0 ? 'Out of stock' : 'Add to cart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => loadProducts(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => loadProducts(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
