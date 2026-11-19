# MultiMart – Multi-Vendor E-Commerce Marketplace

An Amazon-style marketplace with three roles: **customer**, **vendor** and **admin**.
Vendors list products, customers buy them, and the platform keeps a commission on every order.

**Stack:** React (Vite) · Node.js + Express · MongoDB (Mongoose) · Elasticsearch · Redis · AWS S3 · Razorpay (test mode)

## Features
- JWT login/register with role-based access (customer / vendor / admin)
- Vendor shops need admin approval before they can sell
- Product CRUD for vendors, image upload to S3 (falls back to local `/uploads`)
- Search with filters (category, price range) and sorting through Elasticsearch (falls back to MongoDB)
- Cart stored in Redis (falls back to memory)
- Checkout, coupons, Razorpay test payment with signature verification
- Order lifecycle: placed → packed → shipped → delivered (vendors update it)
- Commission split: each paid order stores platform commission and each vendor's earning
- Reviews and ratings (only for products you bought)
- PDF invoices
- Admin analytics page, vendor approval, coupon management

## How to run

You need Node.js 18+ and MongoDB running locally (or a MongoDB Atlas URL).

```bash
# 1. backend
cd backend
npm install
cp .env.example .env      # then edit MONGO_URI / JWT_SECRET
npm run seed              # creates demo users, coupon, sample products
npm run dev               # http://localhost:5000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Demo logins after seeding (password `password123`):
| Role | Email |
|---|---|
| Admin | admin@multimart.com |
| Vendor | vendor@multimart.com |
| Customer | customer@multimart.com |

Coupon to try: `WELCOME10`

### Optional services (set in `backend/.env`)
| Service | Variable(s) | If left blank |
|---|---|---|
| Redis | `REDIS_URL=redis://127.0.0.1:6379` | cart is kept in server memory |
| Elasticsearch | `ELASTIC_URL=http://localhost:9200` | search uses MongoDB |
| AWS S3 | `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | images saved in `backend/uploads` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (test keys) | demo payment button flow |

Run Elasticsearch and Redis quickly with Docker:
```bash
docker run -d -p 6379:6379 redis
docker run -d -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:8.13.4
```
After starting Elasticsearch, run `npm run seed` again on an empty database (or add products from the vendor dashboard) so products get indexed.

## Folder structure
```
backend/
  server.js            app entry, connects MongoDB, mounts routes
  seed.js              demo data
  config/services.js   Redis, Elasticsearch and S3 helpers (with fallbacks)
  middleware/auth.js   JWT check (protect) and role check (allow)
  models/              User, Product, Order, Review, Coupon
  routes/              auth, products, cart, orders, payments, reviews, admin
frontend/src/
  api.js               axios instance that adds the JWT token
  AuthContext.jsx      logged-in user state
  App.jsx              navbar + routes + role-protected pages
  pages/               Home, Auth, ProductPage, Cart, Orders, Vendor, Admin
```

## Database design (summary)
- **User**: name, email, password (hashed), role, shopName, approved
- **Product**: vendor → User, name, description, price, stock, category, image, ratingAvg, ratingCount
- **Order**: customer → User, items[{product, vendor, name, price, qty}], address, subtotal, discount, total, commission, vendorEarnings[], status, paymentStatus, razorpayOrderId
- **Review**: product → Product, user → User, rating, comment (one per user per product)
- **Coupon**: code, percent, active

## API list
| Method | Route | Who |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | anyone |
| GET | /api/auth/me | logged in |
| GET | /api/products (q, category, minPrice, maxPrice, sort, page) | anyone |
| GET | /api/products/:id, /api/products/categories | anyone |
| POST | /api/products/upload | vendor |
| POST/PUT/DELETE | /api/products, /api/products/:id | vendor (own products) |
| GET/POST/PUT | /api/cart, /api/cart/add, /api/cart/update | customer |
| POST | /api/orders | customer |
| GET | /api/orders/mine, /api/orders/vendor | customer / vendor |
| PUT | /api/orders/:id/status | vendor, admin |
| GET | /api/orders/:id/invoice | order owner, admin |
| POST | /api/payments/create, /verify, /mock-confirm | customer |
| GET/POST | /api/reviews/:productId | anyone / customer |
| GET/PUT/POST/DELETE | /api/admin/stats, /vendors, /coupons | admin |

## Payment flow (what to explain)
1. Customer clicks "Place order & pay" → server builds an order from the Redis cart, applies coupon, calculates commission and each vendor's earning.
2. Server creates a Razorpay order (amount in paise) and sends the order id to the browser.
3. Razorpay checkout opens; after payment, the browser sends `payment_id`, `order_id` and `signature` to the server.
4. Server recomputes `HMAC_SHA256(order_id|payment_id, secret)` and compares it with the signature. Only if it matches, the order is marked paid, stock is reduced and the cart is cleared.

> Note: the commission split is calculated and stored in the database. Actually sending money to vendors would need Razorpay Route / Stripe Connect with vendor accounts linked, which is not possible in a plain test setup.

## Deployment (frontend and backend separately)
- Backend: Render / Railway. Set all variables from `.env.example`, use a MongoDB Atlas `MONGO_URI`.
- Frontend: Vercel / Netlify. Set `VITE_API_URL` to the deployed backend URL. `npm run build` creates `dist/`.
- Note: locally saved images disappear on free hosts, so configure S3 for production.

## Things to know for your viva/demo
- Passwords are hashed with bcrypt; the JWT holds only the user id and role.
- `protect` verifies the token, `allow('vendor')` checks the role. Vendors can edit only their own products (`vendor: req.user._id` in the query).
- Search order: Elasticsearch first, MongoDB if it is not available.
- Stock is checked when the order is created and reduced only after payment succeeds.
