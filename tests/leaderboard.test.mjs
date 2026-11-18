import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/leaderboard/index.ts', import.meta.url), 'utf8')
  .replace(/^import .+;\r?\n/gm, '');

function makeHandler(rows, databaseError = null) {
  let handler;
  const calls = [];
  const query = {
    select(fields) { calls.push(['select', fields]); return this; },
    order(field, options) { calls.push(['order', field, options.ascending]); return this; },
    limit(count) {
      calls.push(['limit', count]);
      return Promise.resolve({ data: rows.slice(0, count), error: databaseError });
    },
  };
  vm.runInNewContext(source, {
    Deno: { serve: (callback) => { handler = callback; } },
    handleOptions: (req) => req.method !== 'POST' ? { status: 405, body: { error: 'Method not allowed' }} : null,
    json: (_req, body, status = 200) => ({ status, body }),
    getAdminClient: () => ({ from(table) {
      assert.equal(table, 'profiles');
      return query;
    } }),
  });
  return { handler, calls };
}

test('public Top 100 is ranked by XP without exposing private identifiers', async () => {
  const profiles = Array.from({ length: 101 }, (_, index) => ({
    id: `private-${index}`,
    username: `pioneer${index}`,
    total_xp: 100 - index,
    total_correct: index,
    created_at: '2026-11-18T00:00:00Z',
  }));
  const { handler, calls } = makeHandler(profiles);
  const result = await handler({ method: 'POST' });
  assert.equal(result.status, 200);
  assert.equal(result.body.entries.length, 100);
  assert.equal(result.body.entries[0].rank, 1);
  assert.equal(result.body.entries[99].rank, 100);
  assert.equal(result.body.entries[99].total_xp, 1);
  assert.equal(result.body.entries[0].id, undefined);
  assert.equal(result.body.entries[0].total_correct, undefined);
  assert.deepEqual(calls.filter((x) => x[0] === 'order').map((x) => [x[1], x[2]]), [
    ['total_xp', false], ['total_correct', false], ['created_at', true], ['id', true],
  ]);
  assert.deepEqual(calls.at(-1), ['limit', 100]);
});

test('zero-XP verified accounts are eligible when there are fewer than 100 accounts', async () => {
  const { handler } = makeHandler([{ id: 'private', username: 'pioneer', total_xp: 0, total_correct: 0, created_at: '2026-11-18' }]);
  const result = await handler({ method: 'POST' });
  assert.equal(result.status, 200);
  assert.equal(result.body.entries[0].total_xp, 0);
});

test('database errors are not disclosed to clients', async () => {
  const { handler } = makeHandler([], { message: 'secret connection string' });
  const result = await handler({ method: 'POST' });
  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'Could not load leaderboard.');
});

test('only POST requests are allowed', async () => {
  const { handler } = makeHandler([]);
  const result = await handler({ method: 'GET' });
  assert.equal(result.status, 405);
});

test('frontend excludes demo leaderboard names and public request excludes Pi token', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const backend = readFileSync(new URL('../src/services/backend.ts', import.meta.url), 'utf8');
  assert.equal(/NovaMind|CuriousCat|OrbitFox|BlueComet/.test(app), false);
  assert.ok(app.includes('liveLeaderboard.map(renderLeaderboardRow)'));
  const publicMethod = backend.slice(backend.indexOf('export async function fetchLeaderboard()'), backend.indexOf('export function fetchQuizCatalog('));
  assert.ok(publicMethod.includes('apikey: publishableKey'));
  assert.equal(publicMethod.includes('Authorization:'), false);
});
