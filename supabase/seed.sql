-- Optional original prototype question seed. All questions are drafts, NOT verified.
-- After fact-checking each item and its source, a trusted editor may set review_status='approved'.
insert into public.questions
  (slug, category, difficulty, locale, prompt, options, answer_index, explanation, provenance, review_status, fact_check_notes, source_refs)
values
  ('seed-science-001','Science','easy','en','A tiny seed is placed in a sealed glass jar with moist soil and light. What does the seed use first to begin growing?',
   '["Stored energy inside the seed","Sugar from the soil","Oxygen made by leaves","Minerals from the glass"]'::jsonb,0,
   'A seed contains stored food that powers the earliest stage of germination. Roots and leaves develop later and take on more of the plant''s energy needs.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify botanical details and add reliable sources before approval.','[]'::jsonb),
  ('seed-world-001','World','easy','en','You travel east from a place just before midnight and cross the International Date Line. What unusual calendar change can happen?',
   '["You may move to the previous calendar day","Your clock stops for one hour","The year always changes","The season reverses"]'::jsonb,0,
   'Crossing the International Date Line eastward generally moves the calendar back one day; crossing westward generally moves it forward.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify date-line conventions and add a reliable source before approval.','[]'::jsonb),
  ('seed-tech-001','Technology','medium','en','Why do many data centers place servers in carefully cooled rooms?',
   '["Cool air makes screens brighter","Electronic components produce heat while operating","Cold air increases internet speed directly","Servers stop using electricity when cool"]'::jsonb,1,
   'Processors and other electronic parts release heat. Keeping temperatures within safe ranges helps prevent failures and maintain reliable performance.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify engineering details and add a reliable source before approval.','[]'::jsonb),
  ('seed-nature-001','Nature','medium','en','A group of bees visits many flowers in one afternoon. What important service can they provide to plants?',
   '["They turn sunlight into sugar","They move pollen between flowers","They create rain clouds","They spread roots underground"]'::jsonb,1,
   'When bees move between flowers, pollen can attach to their bodies and be transferred to another flower, helping many plants reproduce.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify pollination details and add a reliable source before approval.','[]'::jsonb),
  ('seed-culture-001','Culture','easy','en','Why might the same hand gesture mean different things in different countries?',
   '["Gestures have universal meanings","Culture shapes how gestures are interpreted","Hands change shape by climate","Gestures are always formal language"]'::jsonb,1,
   'Gestures are part of culture. A movement that is friendly in one place may be confusing or impolite somewhere else.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify examples carefully and add cultural sources before approval.','[]'::jsonb),
  ('seed-logic-001','Logic','medium','en','A library puts a blue sticker on every book about oceans. You find a book with a blue sticker. What can you safely conclude?',
   '["It must be about oceans","It is the newest book","It may be about oceans, but the sticker rule alone does not prove it","It has no pictures"]'::jsonb,2,
   'The rule tells us ocean books have blue stickers, not that only ocean books do. This is the difference between a one-way rule and its converse.',
   'ai-generated-original','draft','Seeded from the original prototype. Logic item; editor should check wording for clarity.','[]'::jsonb),
  ('seed-space-001','Space','easy','en','Why do astronauts aboard the International Space Station appear to float?',
   '["There is no gravity at all","They and the station are continuously falling around Earth together","The air pushes them upward","Their suits cancel their mass"]'::jsonb,1,
   'Earth’s gravity is still strong at the station’s altitude. The station and astronauts are in continuous free fall around Earth, creating the sensation of weightlessness.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify orbital free-fall explanation and add an authoritative source before approval.','[]'::jsonb),
  ('seed-art-001','Art','medium','en','An artist places a small bright object in a mostly dark painting. What visual effect is this most likely to create?',
   '["A focal point that attracts attention","A perfectly flat perspective","A reduction in contrast","A change in the object’s real size"]'::jsonb,0,
   'Strong contrast can guide the viewer’s eye. A bright element against a dark field often becomes a natural focal point.',
   'ai-generated-original','draft','Seeded from the original prototype. Verify art principles and add a suitable source before approval.','[]'::jsonb)
on conflict (slug, locale) do nothing;
