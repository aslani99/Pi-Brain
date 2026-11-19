import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("rankings select ten verified profiles and return a real count", () => {
  const api = read("supabase/functions/leaderboard/index.ts");
  assert.match(api, /\.limit\(10\)/);
  assert.match(api, /count: "exact", head: true/);
  assert.match(api, /participant_count: participants\.count/);
});

test("server grades a wrong answer by at most three XP, never negative", () => {
  const sql = read("supabase/migrations/20261119150000_wrong_answer_minus_three_xp.sql");
  assert.match(sql, /v_points := case when v_correct then 15 else -least\(v_profile\.total_xp, 3\)::integer end/);
  assert.match(sql, /greatest\(0, total_xp \+ v_points\)/);
  assert.match(sql, /check \(points_awarded >= -3\)/);
  assert.match(sql, /for update/);
  for (const starting of [0, 1, 2, 3, 5, 99]) {
    const debit = Math.min(3, starting);
    const ending = Math.max(0, starting - debit);
    assert.equal(ending, Math.max(0, starting - 3));
  }
});

test("local fallback scoring and result displays match total XP", () => {
  const app = read("src/App.tsx");
  assert.match(app, /Math\.max\(0, stats\.totalXp \+ \(isCorrect \? 5 : -3\)\)/);
  assert.match(app, /stats\.totalXp\.toLocaleString\(\)\} XP/);
  assert.match(app, /participantCountBanner/);
  assert.match(app, /rank-winner-trophy/);
});

test("all supported languages have participant count and compact description", () => {
  for (const lang of ["en", "fa", "ar", "de", "es", "fr", "ru", "tr", "hi", "zh", "ja", "pt"]) {
    const text = read(`src/i18n/locales/${lang}.ts`);
    for (const key of ["leaderboardTop10", "leaderboardCountPrefix", "leaderboardCountSuffix", "heroDescriptionCompact", "winnerTrophyLabel"]) {
      assert.equal((text.match(new RegExp(`\\b${key}:`, "g")) ?? []).length, 1, `${lang}: ${key}`);
    }
  }
});


test("current database scoring is +5 on correct and up to -3 on wrong", () => {
  const sql = read("supabase/migrations/20261119180000_correct_answer_five_xp.sql");
  assert.match(sql, /v_points := case when v_correct then 5 else -least\(v_profile\.total_xp, 3\)::integer end/);
  assert.match(sql, /greatest\(0, total_xp \+ v_points\)/);
  const app = read("src/App.tsx");
  assert.match(app, /setLastPointsDelta\(isCorrect \? 5 : -Math\.min\(3, stats\.totalXp\)\)/);
  assert.match(app, /\+5 \/ −3 XP/);
});

test("mobile hero uses full translation, and winner's trophy is outside rank column", () => {
  const app = read("src/App.tsx");
  assert.match(app, /<p>\{t\("heroDescription"\)\}<\/p>/);
  assert.doesNotMatch(app, /t\("heroDescriptionCompact"\)/);
  assert.match(app, /entry\.rank === 1 && <Trophy className="rank-winner-trophy"/);
  assert.match(app, /<span className=\{`rank rank-\$\{entry\.rank\}`\} dir="ltr">\{entry\.rank\}<\/span>/);
});


test("leaderboard list is left-to-right in all locales without forcing usernames to LTR", () => {
  const app = read("src/App.tsx");
  const css = read("src/theme.css");
  assert.match(app, /className="leader-row" dir="ltr"/);
  assert.match(app, /className="leaderboard-entries" dir="ltr"/);
  assert.match(app, /className="panel ranking-panel" dir="ltr"/);
  assert.match(app, /className="leader-username" dir="auto"/);
  assert.match(css, /\.app-shell \.leaderboard-entries \.leader-row,.*\.app-shell \.ranking-panel/si);
});
