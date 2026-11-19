import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const sql = readFileSync('supabase/migrations/20261119203000_enforce_five_xp_scoring.sql', 'utf8');

 test('five points for correct answer, deduct at most three for wrong answer', () => {
  assert.match(app, /isCorrect \? 5 : -Math\.min\(3, stats\.totalXp\)/);
  assert.match(app, /Math\.max\(0, stats\.totalXp \+ \(isCorrect \? 5 : -3\)\)/);
  assert.match(sql, /v_points := case when v_correct then 5 else -least\(v_profile\.total_xp, 3\)::integer end;/);
  assert.match(sql, /greatest\(0, total_xp \+ v_points\)/);
});

test('all five counters appear on Home and Profile, wrong count never negative', () => {
  assert.match(app, /shownWrong = Math\.max\(0, shownAnswered - shownCorrect\)/);
  assert.match(app, /className="stat-grid stat-grid-expanded"/);
  assert.match(app, /className="profile-metrics profile-metrics-expanded"/);
  assert.equal((app.match(/t\("correctAnswersStat"\)/g) ?? []).length, 2);
  assert.equal((app.match(/t\("wrongAnswersStat"\)/g) ?? []).length, 2);
});

 test('all supported languages have both counter labels', () => {
  for (const locale of ['en','fa','ar','de','es','fr','ru','tr','hi','zh','ja','pt']) {
    const source = readFileSync(`src/i18n/locales/${locale}.ts`, 'utf8');
    assert.match(source, /correctAnswersStat:/, locale);
    assert.match(source, /wrongAnswersStat:/, locale);
  }
});
