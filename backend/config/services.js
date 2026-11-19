// This file connects the "extra" services: Redis, Elasticsearch and S3.
// Each one is optional. If it is not configured, we use a simple fallback
// so the project still runs on a normal laptop.
const Redis = require('ioredis');
const { Client } = require('@elastic/elasticsearch');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

/* ---------- Redis (cart + caching) ---------- */
let redis = null;
const memory = new Map(); // fallback when Redis is not available

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => console.log('Redis not reachable, using memory fallback'));
}

async function cacheGet(key) {
  try {
    if (redis) {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    }
  } catch (err) { /* fall through to memory */ }
  return memory.has(key) ? memory.get(key) : null;
}

async function cacheSet(key, value, seconds = 3600) {
  try {
    if (redis) {
      await redis.set(key, JSON.stringify(value), 'EX', seconds);
      return;
    }
  } catch (err) { /* fall through to memory */ }
  memory.set(key, value);
}

async function cacheDel(key) {
  try {
    if (redis) await redis.del(key);
  } catch (err) { /* ignore */ }
  memory.delete(key);
}

/* ---------- Elasticsearch (product search) ---------- */
const INDEX = 'products';
const es = process.env.ELASTIC_URL ? new Client({ node: process.env.ELASTIC_URL }) : null;

async function indexProduct(p) {
  if (!es) return;
  try {
    await es.index({
      index: INDEX,
      id: String(p._id),
      document: {
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        stock: p.stock,
        image: p.image,
        vendor: String(p.vendor),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        createdAt: p.createdAt,
      },
      refresh: true,
    });
  } catch (err) { console.log('ES index error:', err.message); }
}

async function removeProduct(id) {
  if (!es) return;
  try { await es.delete({ index: INDEX, id: String(id), refresh: true }); }
  catch (err) { /* already gone */ }
}

// Returns { products, total } or null when ES is not usable (caller then uses MongoDB)
async function searchProducts({ q, category, minPrice, maxPrice, sort, page, limit }) {
  if (!es) return null;
  try {
    const must = q
      ? [{ multi_match: { query: q, fields: ['name^3', 'category^2', 'description'], fuzziness: 'AUTO' } }]
      : [{ match_all: {} }];

    const filter = [];
    if (category) filter.push({ term: { 'category.keyword': category } });
    if (minPrice || maxPrice) {
      const range = {};
      if (minPrice) range.gte = Number(minPrice);
      if (maxPrice) range.lte = Number(maxPrice);
      filter.push({ range: { price: range } });
    }

    const sortMap = {
      price_asc: [{ price: 'asc' }],
      price_desc: [{ price: 'desc' }],
      rating: [{ ratingAvg: 'desc' }],
      newest: [{ createdAt: 'desc' }],
    };

    const result = await es.search({
      index: INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must, filter } },
      sort: sortMap[sort] || (q ? undefined : [{ createdAt: 'desc' }]),
    });

    return {
      products: result.hits.hits.map((h) => ({ _id: h._id, ...h._source })),
      total: result.hits.total.value,
    };
  } catch (err) {
    console.log('ES search failed, using MongoDB instead:', err.message);
    return null;
  }
}

/* ---------- AWS S3 (image upload) ---------- */
const s3Enabled = !!(process.env.AWS_BUCKET && process.env.AWS_ACCESS_KEY_ID);
const s3 = s3Enabled ? new S3Client({ region: process.env.AWS_REGION }) : null;

async function uploadToS3(file) {
  const key = `products/${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));
  return `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

module.exports = { cacheGet, cacheSet, cacheDel, indexProduct, removeProduct, searchProducts, s3Enabled, uploadToS3 };
