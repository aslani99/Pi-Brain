# Pi Brain — product and UX specification

## Product promise
A welcoming daily discovery habit: short, surprising, carefully checked questions that leave people feeling curious and capable.

## UX principles
1. One obvious primary action per screen.
2. Plain language; explain points, streaks and rewards at the moment they matter.
3. Never punish a wrong answer. Explain the idea warmly and make the next step obvious.
4. Accessible type sizes, high contrast, keyboard focus, touch targets and reduced-motion support.
5. Short sessions with optional deeper explanations.
6. No manipulative streak loss, fake urgency, or confusing reward mechanics.


## Visual identity and interaction language
- Brand direction: Cosmic Arcade — friendly, energetic and futuristic rather than a sterile dashboard.
- Core palette: deep space ink (`#080619`), cosmic violet (`#925eff`), electric cyan (`#4ce4ff`), reward gold (`#ffd05b`), playful pink (`#fb82e8`) and positive mint (`#53edc4`).
- Mascot: an original white-and-violet space robot with cyan face lights and gold Pi chest emblem.
- Motion is functional feedback, not decoration alone: spring response on taps, lift/tilt on category cards, animated active navigation, page-level spring transitions, slide transitions between quiz questions, and distinct correct/wrong answer feedback.
- Keep motion short and readable; honor `prefers-reduced-motion`. Never block input behind long animations.
- Sound: soft original synthesized ambient bed and short UI/answer cues, with a visible mute control. Start audio only after a user gesture and retain the muted state when the user turns sound off.

## Content domains
Science, nature, technology, world geography, history, arts, language, culture, mathematics, logic, everyday knowledge, space, environment, design, food science, sports and inventions.

## Originality and quality pipeline
AI generation -> schema validation -> duplicate/similarity screening -> factual verification against reliable references -> age/sensitivity review -> human approval -> versioned publication.
Never publish a question solely because an LLM generated it. Store source references for checking, but write all question and explanation wording independently.

## Internationalization
Locale-aware strings, number/date formatting, translated content records, font fallback, RTL direction, mirrored navigation where appropriate, text expansion testing and language-specific QA.
Initial prototype locales: en, fa, ar, es, fr, de, pt, hi, zh, ja, ru.
All-living-language coverage is a long-term localization program, not a truthful day-one claim.

## Production services
- Pi SDK authentication: client sign-in plus server-side validation of Pi access token.
- Database: profiles, question catalog, attempts, streak aggregates and leaderboard snapshots.
- Question generation: server-side only; AI secrets never reach the browser.
- Moderation: approval workflow and audit trail.
- Ads: only after eligibility and Pi Core Team approval; ad rewards require server-side verification.
- Analytics: privacy-minimizing event counts, retention and ad metrics where permitted.

## Non-goals for v1
No cash or Pi-token prizes, no public chat, no user-generated questions, no live tournaments, no unnecessary personal data collection.
