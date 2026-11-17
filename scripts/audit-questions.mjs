#!/usr/bin/env node
/** Read-only audit for CSV exports of public.questions. Never changes review_status. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseCsv(input) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('CSV contains an unfinished quoted field.');
  if (row.length || field) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
function escapeCsv(value) {
  const string = value == null ? '' : String(value);
  return /[",\n\r]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}
const [input, output = './audit-output'] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/audit-questions.mjs questions.csv [output-dir]');
  process.exit(2);
}
const text = readFileSync(resolve(input), 'utf8').replace(/^\uFEFF/, '');
const lines = parseCsv(text);
const headerStart = lines.findIndex(row => row[0] === 'id' && row[1] === 'slug');
if (headerStart < 0) throw new Error('CSV headers id,slug were not found.');
const header = lines[headerStart];
for (const required of ['id', 'slug', 'locale', 'category', 'difficulty', 'review_status', 'options', 'answer_index', 'prompt', 'explanation', 'source_refs']) {
  if (!header.includes(required)) throw new Error(`Required column missing: ${required}`);
}
const receivedRows = lines.slice(headerStart + 1).filter(row => row.length && row.some(Boolean) && row[0] !== 'id');
const unique = new Map();
const duplicateExports = [];
for (const row of receivedRows) {
  if (row.length !== header.length) throw new Error(`CSV record has ${row.length} fields; expected ${header.length}.`);
  const record = Object.fromEntries(header.map((key, i) => [key, row[i]]));
  if (unique.has(record.id)) {
    duplicateExports.push(record.id);
    if (JSON.stringify(unique.get(record.id)) !== JSON.stringify(record)) {
      throw new Error(`Conflicting records for id ${record.id}. Merge exports before auditing.`);
    }
  } else unique.set(record.id, record);
}
const records = [...unique.values()];
const flagged = [];
const normalizedPrompts = new Map();
const slugs = new Map();
for (const item of records) {
  const problems = [];
  let options;
  try { options = JSON.parse(item.options); } catch { problems.push('invalid_options_json'); }
  if (!Array.isArray(options) || options.length !== 4 || options.some(v => typeof v !== 'string' || !v.trim())) {
    problems.push('invalid_four_options');
  } else if (new Set(options.map(v => v.trim().toLocaleLowerCase())).size !== 4) problems.push('duplicate_options');
  if (!/^[0-3]$/.test(item.answer_index)) problems.push('invalid_answer_index');
  if (!item.prompt.trim()) problems.push('missing_prompt');
  if (!item.explanation.trim()) problems.push('missing_explanation');
  let sources;
  try { sources = JSON.parse(item.source_refs); } catch { problems.push('invalid_sources_json'); }
  if (!Array.isArray(sources) || sources.length === 0) problems.push('missing_sources');
  const normalized = item.prompt.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  if (normalizedPrompts.has(`${item.locale}:${normalized}`)) problems.push(`possible_duplicate_prompt:${normalizedPrompts.get(`${item.locale}:${normalized}`)}`);
  else normalizedPrompts.set(`${item.locale}:${normalized}`, item.id);
  if (slugs.has(item.slug)) problems.push(`duplicate_slug:${slugs.get(item.slug)}`);
  else slugs.set(item.slug, item.id);
  if (item.review_status === 'approved' && problems.length) problems.push('approved_requires_manual_recheck');
  flagged.push({ ...item, flags: problems.join(';') });
}
const tally = (key) => Object.fromEntries([...records.reduce((m, x) => m.set(x[key], (m.get(x[key]) ?? 0) + 1), new Map()).entries()].sort());
const summary = {
  input_rows: receivedRows.length,
  unique_question_ids: records.length,
  overlapping_export_rows: duplicateExports.length,
  review_status: tally('review_status'),
  locale: tally('locale'),
  category: tally('category'),
  difficulty: tally('difficulty'),
  questions_missing_sources: flagged.filter(x => x.flags.includes('missing_sources')).length,
  approved_requiring_manual_recheck: flagged.filter(x => x.flags.includes('approved_requires_manual_recheck')).length,
  possible_duplicate_prompts: flagged.filter(x => x.flags.includes('possible_duplicate_prompt')).length,
  note: 'Read-only structural audit, not a factual verification or approval. Overlapping export rows are not duplicate database records.',
};
mkdirSync(resolve(output), { recursive: true });
const columns = ['id', 'slug', 'locale', 'category', 'difficulty', 'review_status', 'flags', 'prompt'];
writeFileSync(resolve(output, 'question-review-queue.csv'), [columns.join(','), ...flagged.map(item => columns.map(key => escapeCsv(item[key])).join(','))].join('\n') + '\n');
writeFileSync(resolve(output, 'audit-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
