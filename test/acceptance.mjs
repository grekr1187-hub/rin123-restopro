import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`);
  const body = await r.json().catch(() => ({}));
  assert.equal(r.ok, true, `${path}: ${body.error || r.status}`);
  return body;
};

const bootstrap = await get('/api/bootstrap');
assert.ok(bootstrap.restaurant, 'bootstrap.restaurant is required');
assert.ok(Array.isArray(bootstrap.staff), 'bootstrap.staff is required');
assert.ok(Array.isArray(bootstrap.dishes), 'bootstrap.dishes is required');
assert.ok(Array.isArray(bootstrap.orders), 'bootstrap.orders is required');
assert.ok(bootstrap.tables?.every(t => 'service_pct' in t), 'tables must expose service_pct');

const staff = await get('/api/staff');
assert.ok(staff.every(s => 'username' in s && 'rating' in s), 'staff must expose username and rating');

const reports = await get('/api/reports');
assert.ok(Array.isArray(reports.dishes), 'reports.dishes is required');
assert.ok(Array.isArray(reports.waiters), 'reports.waiters is required');

const recipes = await get('/api/recipes');
assert.ok(Array.isArray(recipes), 'recipes must be an array');

const memory = await get('/api/ai/memory');
assert.ok(Array.isArray(memory), 'AI memory must be an array');

console.log('RestoPro acceptance contract passed');
