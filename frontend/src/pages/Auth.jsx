import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import { useAuth } from '../AuthContext.jsx';

export default function Auth() {
  const { saveLogin } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'customer', shopName: '' });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const url = isRegister ? '/auth/register' : '/auth/login';
      const { data } = await api.post(url, form);
      saveLogin(data);
      // send each role to its own page
      if (data.user.role === 'vendor') navigate('/vendor');
      else if (data.user.role === 'admin') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setMessage(errorMessage(err));
    }
  };

  return (
    <form className="panel narrow" onSubmit={handleSubmit}>
      <h2>{isRegister ? 'Create an account' : 'Login'}</h2>

      {isRegister && (
        <>
          <label>Name</label>
          <input name="name" value={form.name} onChange={handleChange} required />
          <label>I want to</label>
          <select name="role" value={form.role} onChange={handleChange}>
            <option value="customer">Buy products (customer)</option>
            <option value="vendor">Sell products (vendor)</option>
          </select>
          {form.role === 'vendor' && (
            <>
              <label>Shop name</label>
              <input name="shopName" value={form.shopName} onChange={handleChange} required />
            </>
          )}
        </>
      )}

      <label>Email</label>
      <input name="email" type="email" value={form.email} onChange={handleChange} required />
      <label>Password</label>
      <input name="password" type="password" value={form.password} onChange={handleChange} required />

      {message && <p className="error">{message}</p>}
      <button type="submit">{isRegister ? 'Register' : 'Login'}</button>

      <p className="small">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <button type="button" className="link-btn" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Login' : 'Create an account'}
        </button>
      </p>
    </form>
  );
}
