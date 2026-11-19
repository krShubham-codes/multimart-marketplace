import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Home from './pages/Home.jsx';
import Auth from './pages/Auth.jsx';
import ProductPage from './pages/ProductPage.jsx';
import Cart from './pages/Cart.jsx';
import Orders from './pages/Orders.jsx';
import Vendor from './pages/Vendor.jsx';
import Admin from './pages/Admin.jsx';

// Only lets the right role open a page
function RoleRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="navbar">
        <Link to="/" className="brand">MultiMart</Link>
        <nav>
          {user?.role === 'customer' && (
            <>
              <Link to="/cart">Cart</Link>
              <Link to="/orders">My orders</Link>
            </>
          )}
          {user?.role === 'vendor' && <Link to="/vendor">Vendor dashboard</Link>}
          {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
          {user ? (
            <>
              <span className="muted">Hi, {user.name}</span>
              <button className="link-btn" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<RoleRoute role="customer"><Cart /></RoleRoute>} />
          <Route path="/orders" element={<RoleRoute role="customer"><Orders /></RoleRoute>} />
          <Route path="/vendor" element={<RoleRoute role="vendor"><Vendor /></RoleRoute>} />
          <Route path="/admin" element={<RoleRoute role="admin"><Admin /></RoleRoute>} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
