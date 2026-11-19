import axios from 'axios';

// In development the Vite proxy handles "/api". After deployment set VITE_API_URL.
const base = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: base + '/api' });

// attach the JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

// product images saved locally start with /uploads, so we add the backend url
export const imageUrl = (path) => {
  if (!path) return 'https://placehold.co/400x300?text=No+Image';
  return path.startsWith('/uploads') ? base + path : path;
};

export const errorMessage = (err) => err.response?.data?.message || 'Something went wrong. Try again.';

export default api;
