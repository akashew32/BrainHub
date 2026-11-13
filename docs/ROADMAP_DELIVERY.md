# Mathematics learning delivery ledger

User request: ship the first six lessons in each of five roadmaps (30 original lessons and about 300 mathematical questions), proper formula rendering, server grading, stage exams, and question-level review. Push this initial release. Then complete **20 additional cycles**, each consisting of additions/updates, a review and improvement pass, verification, and a GitHub push.

This ledger records delivery; a planned item is not evidence of completion. The goal stays active until the initial release and all 20 subsequent cycles are implemented, reviewed, verified, and pushed.

## Baseline release — pushed as `b15f1c4`

- Author 30 topic-specific lessons, 60 concrete worked examples, and 300 original questions.
- Render mathematical notation with accessible KaTeX/MathML.
- Keep answer keys server-side; grade numeric, fraction, vector, matrix, choice, and proof-order answers.
- Persist individual answers, correctness, concept, session, and timestamps.
- Offer practice sessions, balanced stage exams, and review based on recent retrieval attempts.
- Protect new lesson completion from client-supplied scores.
- Verify content contracts, grading, API persistence, frontend flow, production build, and live UI.
- Commit and push, recording the remote commit below.

## Twenty subsequent improvement cycles

Each cycle must identify a batch of useful changes, implement them, review and improve the implementation, verify the relevant behavior, and push a separate commit. Scope may adapt to actual findings; do not count cosmetic commits or unexecuted plans as cycles.

| Cycle | Planned focus | State | Pushed commit and verification |
| --- | --- | --- | --- |
| 1 | Assessment resume, durable answer drafts, and recovery | Complete | `64fec27`; 106 backend tests, 57 frontend tests, full build, live refresh recovery |
| 2 | Stronger mathematical input handling and answer previews | Complete | `dff08d9`; 239 backend tests, 183 frontend tests, 107 shared input fixtures, full build, live 8/8 expression grading |
| 3 | Structured proof builder and proof-specific feedback | Complete | `cc1f23c`; 295 backend tests, 201 frontend tests, 492 proof permutations, full build, live recovery and dependency feedback |
| 4 | Per-question hints with assisted/independent mastery | Complete | `c9f9da5`; 316 backend tests, 217 frontend tests, fresh/existing migrations, full build, live 100% overall / 75% independent |
| 5 | Spaced review scheduling and daily retrieval practice | Complete | `caf3cc5`; 335 backend tests, 228 frontend tests, full build, live due-to-scheduled review flow |
| 6 | Mistake notebook and concept-level performance | Complete | `744f7a3` + CI test fix `e054ca3`; 351 backend tests, 252 frontend tests, fresh/existing migrations, full build, live two-tab reflection conflict/recovery |
| 7 | Exam readiness, blueprint, and prerequisite evidence | Complete | `3a31936`; 380 backend tests, 262 frontend tests, full build, live checklist and direct server gate; GitHub CI passed |
| 8 | Exam integrity, retry policy, and robust session lifecycle | Complete | `0352758`; 417 backend tests, 284 frontend tests, fresh/existing migrations, full build, live stable assignment and idempotent replay; GitHub CI passed |
| 9 | Learning dashboard and recent learning history | Complete | `4ffb8f0`; 451 backend tests, 312 frontend tests, 538 static pages plus dynamic session viewer, live dashboard/history/recovery; GitHub CI passed |
| 10 | Diagnostic placement across foundation topics | Complete | `0e39568`; 480 backend tests, 335 frontend tests, 543 static pages plus dynamic viewer, live perfect sample without mastery credit; GitHub CI passed |
| 11 | Personalized study sessions and time goals | Complete | `8cdcdf9`; 531 backend tests, 384 frontend tests, fresh/existing migration, 544 static pages plus dynamic viewer, live preferences/study/time credit; GitHub CI passed |
| 12 | Question variations and meaningful repeat practice | Pending | |
| 13 | Interactive vector and transformation exploration | Pending | |
| 14 | Interactive counting/probability exploration | Pending | |
| 15 | Function and limit exploration | Pending | |
| 16 | Logic, counterexample, and proof exploration | Pending | |
| 17 | Curriculum search, filters, and study bookmarks | Pending | |
| 18 | Learning data portability and user controls | Pending | |
| 19 | Accessibility, responsive layouts, and performance audit | Pending | |
| 20 | Content accuracy audit, integration hardening, release verification | Pending | |

## Evidence

Baseline before implementation: commit `6562832`, clean worktree, 300 templated lesson pages. Delivery after that baseline is recorded below.

Initial release remote verified at `b15f1c469c2a04126c10e8b5665edbe92c9c2511` on `main`.

The initial GitHub Actions run also passed: https://github.com/akashew32/BrainHub/actions/runs/43329831957.

Initial release verification: 41 frontend tests and 92 backend tests, including independent calculus arithmetic checks; strict rendering of all 2,507 math fragments and 74 independent arithmetic fixtures; all 535 routes built. The migration succeeds both from the existing local schema and from an empty database. Live browser evidence: a practice session returned 88% (7/8), persisted completion, surfaced the one missed question in review, and displayed eight answers/88% accuracy/one concept to review in Statistics. No browser console errors were observed.

Review corrections before first push: randomized choice presentation, accepted alternate valid proof orders, one ambiguous supremum distractor, an exam proof that repeated a worked example, and a counterexample question that disclosed its own witness. Legacy template scores remain stored but do not establish authored-course mastery. A local SQLite backup was created before applying the new schema.

### Cycle 1 review — recovery

Batch: resume open assessments; save partial answers locally and to the profile; recover completed results after a lost response; preserve expired-session answers for reference.

Review-driven improvements: increasing draft revisions plus an atomic database predicate prevent late saves from overwriting newer answers; server ownership and expiry checks; draft writes cannot grant mastery; cache keys isolate lessons and practice/exam/review modes; inputs freeze during grading; malformed or unavailable browser storage must not block practice. The first-save predicate uses the completion timestamp rather than SQL `IS NULL` on a JSON column, which distinguishes SQL null from JSON null correctly.

Cycle 1 verification: 106 backend tests and 57 frontend tests pass, along with lint, formatting, type checks, a fresh migration through revision 0004, and a 535-route production build. A live browser test saved an unfinished matrix answer containing a fraction, reloaded the page, and recovered the exact raw answer. Direct SQLite inspection confirmed revision 1 and the unchanged graded-attempt count. Additional review fixed changed-curriculum recovery (HTTP 409), invalid choice/proof cache snapshots, duplicate question IDs, and deletion resurrection during revision reconciliation.

Cycle 1 remote verified at `64fec2760fecb6d6ed46ee634073c4f720ecb11f` on `main`.

Cycle 1 GitHub Actions also passed: https://github.com/akashew32/BrainHub/actions/runs/43332084075.

### Cycle 2 batch — mathematical input

Add a bounded arithmetic grammar for fractions, radicals, powers, and constants; natural vector/matrix entry; syntax-only browser previews; a shared cross-language conformance corpus; and exact grading of integer-valued answers. Review must cover malicious input, parser bounds and precedence, malformed later coordinates, preservation of unfinished drafts, and integer counts that loose relative tolerance could otherwise mark incorrectly.

Review improvements: rational bit-size checks run before expensive operations; integer results require exact rational provenance; unsafe floating-point cancellation cannot grant integer mastery; previews warn instead of showing rounded unsafe values; inclusive `1e100` screening is consistent; whitespace, quoted entries, matrix row syntax, and container-depth boundaries match across parsers. The lesson page now falls back to a validated device copy so a lesson-fetch failure cannot hide an otherwise recoverable assessment draft. Pure parser tests no longer recreate the database; API tests still receive isolated database cleanup.

Live cycle 2 evidence: a browser practice set submitted natural vector expressions, powers, fractions, and exact square roots. The preview interpreted five mathematical answers correctly and the API returned 100% (8/8), saving the result. The clean verification tab reported no console errors.

Cycle 2 final verification: 239 backend tests and 183 frontend tests pass; lint, formatting, type checks, the strict 30-lesson/300-question curriculum verifier, and the 535-route production build pass. All 107 shared parser fixtures conform, including explicit browser precision-warning cases. Independent final review found no remaining contradictions. Nonfinite draft input now returns a safe validation response without changing the saved draft.

Cycle 2 remote verified at `dff08d91065391f8dfc6a83d56b785b25fd8ba37` on `main`.

Cycle 2 GitHub Actions passed: https://github.com/akashew32/BrainHub/actions/runs/43335711697.

### Cycle 3 batch — proof construction and reasoning

Replace manual ordering with an accessible proof composer that saves partial selections and supports adding, removing, and moving steps. Author private prerequisite graphs and per-step justifications for all 21 proof problems. Grade every valid topological order; after submission, explain violated prerequisites and show one valid proof. Keep partial work separate from mastery and keep dependencies and justifications private until submission.

The content review found a concrete grading gap: the supremum proof's upper-bound argument can be established independently of its epsilon witness. A prerequisite graph accepts those valid alternatives without treating an arbitrary displayed sequence as the only mathematical proof.

Cycle 3 review improvements: permit independent base-case placement in induction, make its final conclusion explicit, validate graph references and acyclicity, preserve the learner's valid prefix in the reference continuation, and display step justifications after grading. Correct alternative proofs receive matching expected-order feedback. Changed curriculum now rejects an open submission atomically rather than failing partway through grading. Keyboard actions announce their outcome and retain useful focus; the optional raw-order editor preserves malformed legacy drafts without silently repairing them.

Cycle 3 verification: all 295 backend tests and 201 frontend tests pass, with clean formatting, lint, and type checks. Independent exhaustive checks cover all 492 permutations of the 21 proofs: exactly 30 valid chains are accepted, correction chains remain valid, and valid prefixes are retained. The strict content verifier validates every graph and all 79 justifications. All 535 routes pass the production build. Live browser checks confirm keyboard addition/reordering, partial draft recovery after refresh, incomplete-proof completion counts, and accurate missing-prerequisite feedback with per-step explanations. No browser console errors were observed. Final review also aligned strict integer step labels in browser and server parsing so decimal/exponent tokens cannot silently become integer identifiers.

Cycle 3 remote verified at `cc1f23c48ebb879c05ad800f1e21a88ebf9b4ad7` on `main`.

Cycle 3 GitHub Actions passed: https://github.com/akashew32/BrainHub/actions/runs/43337416475.

### Cycle 4 batch — assistance and independent performance

Reveal hints sequentially through the server, record assistance separately from answer drafts, and report total and independent performance distinctly. Requests must be idempotent and must not race submission into a false claim of independent work. Older attempts with unrecorded hint usage remain explicitly untracked. Keep normal lesson progress while providing additional evidence of independent mastery for future review scheduling.

Scoring decision: independent score counts correct answers with confirmed zero hint use over every question in the set; assisted correct answers still count toward the normal practice score. A nullable independent score preserves uncertainty for older attempts. Hint events and finalization share a revision guard; answer drafts cannot reset assistance. Stage-exam readiness changes remain in cycle 7 so the gate and its explanatory interface can change together.

Cycle 4 migration verification: the existing local database upgrades from 0004 to 0005, and an empty database upgrades through all revisions to 0005. A local SQLite backup was saved before the upgrade. Live recovery checks preserve an unfinished vector answer and three revealed hints across two questions after a full page reload.

Cycle 4 review improvements: atomic progress updates preserve best scores, attempt counts, and study time when different sessions finish together; a completion claim uses the same hint revision as grading. The UI merges out-of-order hint responses without erasing newer answers or other revealed hints, blocks submission while a reveal is pending, and preserves legacy uncertainty. Tests cover score zero versus unknown, explicit server null, duplicate hint requests, and both orders of hint/submission races.

Cycle 4 backend verification: all 316 backend tests pass with clean Ruff formatting/lint and mypy. Live practice returned 100% overall and 75% independently after three hints across two questions; correct unhinted answers count toward the independent score, and multiple hints on one question do not multiply the deduction. The result includes an explicit assistance label, persists progress, and produced no console errors.

Cycle 4 final frontend verification: all 217 tests, formatting, lint, and type checks pass; all 535 routes build for production. Targeted tests cover sequential reveal/privacy, duplicate clicks, failed responses, delayed answer edits, autosaving, server recovery, out-of-order responses, nullable independent scores, and legacy/untracked labels.

Cycle 4 remote verified at `c9f9da5fde3f4d01cc93ba6dab4a11c792ee57b6` on `main`. Four of twenty improvement cycles are complete; cycles 5–20 remain part of the active goal.

Cycle 4 GitHub Actions passed: https://github.com/akashew32/BrainHub/actions/runs/43339530111.

Next recommended batch (cycle 5): a daily spaced-review queue using missed, assisted, and independent responses. Bring missed and assisted questions back sooner, lengthen intervals after independent recall, show why each item is due, and cap daily sessions so review stays manageable. Page visits must not advance the review schedule.

### Cycle 5 batch — adaptive spaced review

Use one deterministic scheduler for the displayed queue, review-session selection, and due-concept statistics. Missed, hinted, and assistance-untracked answers return immediately. Independent correct answers start a one-day interval, then advance through 3, 7, 14, 30, 60, and 90 days when recalled on time. Early correct practice neither advances the interval nor postpones the existing due time. These are transparent product rules, not a claim of an optimal learning schedule.

Build a daily review page with all five subject totals, reasons and due dates, upcoming reviews, and sets of at most eight questions. Refresh the queue after grading while keeping the submitted feedback visible. Schedules derive from immutable graded attempts; reading a page, saving a draft, or opening a session does not change them. Daily activity uses explicit UTC boundaries.

Cycle 5 review improvements: compare due times as datetimes so fractional-second formatting cannot reverse chronological order; isolate matching question IDs across roadmaps; preserve the original due date through early practice; keep zero-due subject contexts available for draft recovery; preserve active work after a refresh failure; and retain submitted feedback when the queue refreshes to zero.

Cycle 5 verification: all 335 backend tests and 228 frontend tests pass, with clean formatting, lint, and type checks; all 535 routes build for production. Live browser evidence started with two hint-assisted questions due and six scheduled. Reading the plan and opening a review session left the graded-attempt count unchanged at 32. Submitting two correct answers without hints returned 100%, refreshed the queue to zero due/eight scheduled, recorded two independent recalls for the UTC day, retained worked feedback, and disabled starting another empty set. Direct SQLite inspection confirms 34 saved answers with the two new review answers marked correct and unhinted. Final review also fixed composite React keys for identical question IDs in different subjects and added a filtering regression test.

Cycle 5 remote verified at `caf3cc50b089ea1b3784b8edd495a2312cb18b43` on `main`.

Cycle 5 GitHub Actions passed: https://github.com/akashew32/BrainHub/actions/runs/43342383238.

### Cycle 6 batch — mistake notebook and concept performance

Retain a notebook of historical mistakes, assisted answers, and assistance-untracked answers after correction. Show owned historical feedback snapshots and distinguish resolved entries from questions currently due. Keep archived questions readable without exposing current answer keys. Add persistent, revision-protected reflection notes with local recovery and explicit conflict handling. Add subject/topic/concept metrics with separate independent, assisted, and untracked accuracy and a 14-day UTC activity table; empty accuracy is unknown, not zero. Use bounded, snapshot-anchored pagination so new submissions cannot move existing pages while a learner browses.

Cycle 6 migration verification: the existing local database upgrades from 0005 to 0006, and an empty database upgrades through all revisions to 0006. A local SQLite backup was saved before upgrading. Reflection notes use a separate table, preserving immutable graded attempts and review evidence.

Cycle 6 live evidence: eight resolved entries remain available; the original incorrect proof attempt displays its saved answer, reference sequence, and worked justification. The concept view reports 34 answers, 32 correct, and 94% overall accuracy with separate assistance buckets. A two-tab reflection test saved revision 1, then revision 2 from one tab; the other tab's stale save preserved its text and showed the newer saved version. Explicit conflict resolution saved revision 3, which survived a full reload. SQLite confirms one 255-character note at revision 3 and the unchanged 34 graded answers. The review plan remains zero due/eight scheduled, so notes do not create mastery or move review dates.

Cycle 6 review improvements: malformed cursor UTC overflow returns validation feedback; note-write contention returns a retryable conflict; current answer banks are used only to determine navigation availability; newly submitted backdated attempts cannot move a snapshot page; local recovery prefers newer in-memory text when device writes fail; and save acknowledgements clear only the matching draft, preserving another tab's newer text.

Cycle 6 final verification: all 351 backend tests and 252 frontend tests pass, with clean formatting, lint, and type checks. The strict 30-lesson/300-question content verifier passes. All 536 routes, including the notebook page, build for production. A Windows permission error in generated build output was resolved by clearing only the verified workspace `.next` directory and rerunning the successful build. No source workaround was required.

Cycle 6 GitHub CI caught a frontend test that asserted the note value as soon as the editor appeared, before its restoration effect enabled it. The test now waits for the named editor's enabled, restored state and still checks that a late response from the previous question cannot replace it. The same explicit readiness check protects other notebook editor interactions. The correction changes tests only; focused notebook/reflection tests, type checks, lint, and formatting pass.

Cycle 6 release and correction are remote verified at `744f7a31cc7a46738d345e51f83d2d82a6d2d1e3` and `e054ca388237a3943a70d2af2d0a1046487cb1cb` on `main`. The corrected GitHub Actions run passed: https://github.com/akashew32/BrainHub/actions/runs/43345465697. Six of twenty improvement cycles are complete; cycles 7–20 remain part of the active goal.

Next batch (cycle 7): server-derived exam readiness for all five foundation stages, a six-lesson independent-performance checklist, a public question-count/type blueprint without reserved questions or keys, clear study links and legacy-evidence explanations, and matching server-side eligibility. Keep overall lesson completion distinct from evidence of independent performance, and preserve earlier results. The readiness interface and exam gate must change together.

### Cycle 7 batch — exam readiness and prerequisite evidence

Recompute readiness from owned, completed practice sets and their saved question-level answers. Each of the six current eight-question sets must demonstrate at least 75% independently correct answers within one completed set; do not combine answers across separate failed sets. Client progress rows and result flags alone cannot unlock an exam. Older untracked assistance remains unknown. Earlier qualifying evidence is retained after a later failed practice set.

Show the six-lesson checklist, overall and independent scores, legacy/outdated-evidence explanations, lesson links, and an exam blueprint limited to counts and question kinds/difficulties. Lock only new exam starts until server readiness is known and eligible. Existing exams, answer drafts, submissions, and historical results remain accessible even if the new prerequisites are not yet met.

Cycle 7 verification: all 380 backend tests and 262 frontend tests pass, with clean formatting, lint, and type checks; all 536 routes build for production. The content verifier still validates 30 lessons, 300 questions, and all 21 proof graphs. Tests cover all five private blueprints, forged summary/progress flags, exact answer membership, ownership, unknown hint provenance, the 6/8 versus 5/8 boundary, and avoiding cross-session cherry-picking. A six-lesson API flow unlocks the balanced twelve-question exam; already-created exams remain recoverable and submittable.

Cycle 7 live evidence: the current profile shows one of six linear algebra lessons ready, with 100% overall and 75% independent practice. The other five lessons offer study links and no invented score. The exam start button is disabled. A direct fresh-exam POST returns 409 with the independent-practice requirement and leaves the exam-session count unchanged at zero. No browser console errors were observed.

Cycle 7 remote verified at `3a3193680e8756b66295cfc45ac42eee84f7ca88` on `main`. GitHub Actions passed: https://github.com/akashew32/BrainHub/actions/runs/43347558552.

### Cycle 8 batch — stable assignments and recoverable starts

Freeze the private question definitions and public presentation when a session starts, so an in-progress assessment retains the same questions, choice order, hints, and grading after curriculum edits. Keep private definitions server-side. Recover the same session after a lost start response by using a profile-owned request ID; replay it before fresh-start eligibility checks and reject reuse for another scope.

Expose server-confirmed session state and precise remaining time. Use a monotonic browser countdown after a fresh response, retain expired answers as read-only, and recover completed results even when a legacy question has been archived. Cached time must not restart a deadline after a reload. Preserve compatible historical readiness evidence while recognizing changes to the assigned mathematics.

Cycle 8 migration verification: the existing local database upgrades from 0006 to 0007, and an empty database upgrades through all revisions to 0007. A local SQLite backup was saved before upgrading. The new assignment snapshot and start-request ID are nullable for existing sessions; request IDs are unique per profile.

Cycle 8 backend verification: all 417 backend tests pass, with clean Ruff formatting/lint and mypy. Independent audit tests cover snapshot privacy and deep copying, semantic versus editorial changes, choice order, proof numbering, and the microsecond expiry boundary. Integration tests cover canonical UUIDs, ownership, scope conflicts, concurrent starts, replay before fresh eligibility checks, frozen grading and hints after current-bank removal, and completed legacy archives. The 30-lesson/300-question content verifier still passes.

Cycle 8 live evidence: a new probability practice session persisted an unfinished `26 * (` answer at revision 1. A browser refresh recovered the exact text, preserved the choice order, and continued the server-confirmed countdown. Replaying its original start request returned HTTP 200 with the same session and saved draft, zero duplicate allocations, and eight frozen question definitions. The graded-answer count remained 34. No browser console errors were observed.

Cycle 8 review improvements: validate completed feedback before accepting an archived empty question list; isolate pending start intents by full assessment scope and preserve another tab's newer token; keep retry identity in memory when device storage fails; subtract request latency from the server-relative countdown; use a separate precise expiry timer alongside quiet display updates; and persist known closure after an HTTP 410 so an offline refresh cannot reopen the attempt. Raw fraction, matrix, and proof text remains available for copying.

Cycle 8 final frontend verification: all 284 tests pass with clean ESLint, formatting, and TypeScript checks. Tests exercise lost start responses, deliberate retries after reload, changed exam eligibility, new-session token rotation, storage failures, wrong-token and stale responses, client clock skew and clock jumps, latency, exact expiry, archived results, and preserved choice presentation. All 536 routes build for production with the final timer change included.

Cycle 8 remote verified at `035275888be1f7e8dd46c45f7e0c427d0b1578a4` on `main`. GitHub Actions passed for backend, frontend, and Docker configuration: https://github.com/akashew32/BrainHub/actions/runs/43350759766. Eight of twenty improvement cycles are complete; cycles 9–20 remain part of the active goal.

Next proposed batch (cycle 9): a learning dashboard across all five roadmaps with due reviews, recent completed work, recoverable active sessions, independent performance, and a clear next lesson. Derive progress from saved server evidence and distinguish authored lessons from the remaining curriculum outlines. Include empty, offline, archived, and unavailable states without inventing activity or scores.

### Cycle 9 batch — learning dashboard and owned session history

Bring the existing review schedule, independent practice readiness, and concept performance together on a dedicated learning dashboard. Show all five subjects and explain each recommended next action. Add bounded profile-owned assessment history containing lifecycle and result summaries, with no question bodies, answers, hints, or private assignment definitions.

Provide a generic assessment viewer that can reopen a selected saved session without relying on its lesson page or browser storage. Explicit session selection takes precedence over unrelated local drafts; only a draft for that same session may merge newer answer text. Keep archived results and expired answers readable, and preserve access to previously started exams independently of new-exam eligibility. History filters reflect live session state; cursor pagination does not claim to freeze state changes between requests.

Cycle 9 review improvements: publish each dashboard resource as soon as it settles; retain all five subject contexts when another request fails; distinguish weak independent performance from missing evidence; query active work separately from recent history; and label history ordering and dates explicitly. Session summaries fail closed for corrupt snapshots or results, expose no question content, and use profile/filter-bound cursors. History and owned recovery responses use `Cache-Control: private, no-store`.

Cycle 9 selected-session safeguards: isolate per-session drafts and mirror to a lesson draft only when absent or already the same session; retain newer matching raw text when returning to a lesson; suppress fresh allocation under a selected-session URL; reject wrong-resource and malformed draft responses; and preserve matching cached answers read-only after legacy 409/410 responses while 404 does not expose cached content. Existing exam recovery remains separate from fresh-start eligibility.

Cycle 9 verification: all 451 backend tests and 312 frontend tests pass with clean formatting, lint, and type checks. The production build generates all 538 static pages and the dynamic UUID session viewer. An initial build-directory cleanup encountered a briefly locked development cache; after confirming the server had stopped, cleanup and the full production build succeeded. No source workaround was needed.

Cycle 9 live evidence: the dashboard displays all five learning plans, zero due/eight scheduled reviews, two independent recalls today, and 8/8 independently correct answers. Linear algebra correctly recommends the second lesson after one of six lessons qualifies; the other subjects show their first lesson without invented scores. History lists one active, one expired, and five completed sessions. Direct links restore the active probability expression `26 * (`, the expired matrix answer `[["1/2", 2], [3, 4]]`, and the saved 100% two-question review result. After browsing, SQLite still contains 34 graded answers, seven sessions, and one reflection note. No browser console errors were observed.

Cycle 9 remote verified at `4ffb8f0c7c7ac4d430dcb84524b34a7a24ce73f2` on `main`. GitHub Actions passed for backend, frontend, and Docker configuration: https://github.com/akashew32/BrainHub/actions/runs/43353669254. Nine of twenty improvement cycles are complete; cycles 10–20 remain part of the active goal.

Next proposed batch (cycle 10): a twelve-question foundation diagnostic for each subject, using one foundation and one core practice question from each of its six authored lessons. Exclude reserved exam questions and disable hints. Reuse frozen assignments, recovery, and history. Show per-topic counts out of two and limited-sample study guidance; diagnostic results must not grant lesson completion or exam eligibility. Preserve graded answers for the notebook, concept performance, and later question-level review.

### Cycle 10 batch — foundation diagnostics

Offer a diagnostic entry for each of the five authored foundation stages. Assign exactly one foundation and one core practice question from each lesson, shuffle the twelve-question set, and freeze it using the existing assignment and retry lifecycle. Reserved exam questions are excluded. Disable hints in every presentation, recovery, and reveal path.

After grading, show six topic samples with counts out of two, a clear limitation statement, and guidance toward the full eight-question lesson practice. Diagnostic answers contribute to question-level review and performance history, but never create topic progress, unlock an exam, or substitute for a complete independent practice set. Reuse the dashboard, session history, archived feedback, raw draft recovery, and expiry safeguards for the new mode.

Cycle 10 review improvements: centralize the four assessment modes and hint policy; remove qualification language from active and completed diagnostic views; validate topic counts, percentages, priorities, and null progress before accepting diagnostic results; and keep history labels explicit about samples. Recovery and repeated submissions project current study-link availability without rewriting immutable saved grades, titles, feedback, or guidance. Archiving or changing sampled mathematics removes its study link; editorial-only changes preserve it.

Cycle 10 live evidence: a calculus diagnostic assigned twelve questions across the six lessons, with no hint controls. Unfinished fraction and vector entries survived a refresh. Completing the sample returned 100% and six 2/2 topic rows recommending full practice. The profile moved from 34 to 46 graded answers and retained twelve correct, unhinted diagnostic answers, while calculus still had zero progress rows and zero qualifying lessons. A direct fresh calculus exam request returned 409, and the exam count remained zero. Filtered history and the UUID viewer recovered the same saved sample and all six guidance rows. No browser console errors were observed.

Cycle 10 verification: all 480 backend tests and 335 frontend tests pass, with clean formatting, lint, and type checks. Tests cover all five balanced samples, exclusion of reserved items, no-hint enforcement, no mastery/exam credit, question-level review, frozen/archive navigation, retries, expiry, history, and existing modes. The production build generates all 543 static pages plus the dynamic session viewer. The full frontend run exposed an older test that clicked before assessment recovery enabled its controls; the test now waits for enabled start and answer controls while retaining its grading assertions. No product or JSDOM workaround was needed.

Cycle 10 remote verified at `0e39568543cc3c2c6b3a9bdcd3caeccb8827236c` on `main`. GitHub Actions passed for backend, frontend, and Docker configuration: https://github.com/akashew32/BrainHub/actions/runs/43356462407. Ten of twenty improvement cycles are complete; cycles 11–20 remain part of the active goal.

Next proposed batch (cycle 11): revision-protected study preferences, daily recorded-time goals, and short personalized study sets. Keep each set within one subject and select compatible practice questions from due recall, weak concepts, and the next foundation lesson; exclude reserved exam items. Freeze the effective budget and selection reasons, allow tracked hints, and keep study work separate from mastery qualification. Use bounded visible-time segments anchored to server time and a monotonic client clock, count them only on completed owned sessions, merge overlaps across sessions and UTC days, and keep legacy missing time explicitly unknown. Preference conflicts must preserve unsaved changes.

### Cycle 11 batch — personalized study and recorded-time goals

Persist profile-owned daily goals, session budgets, and an optional preferred subject with revision-protected updates and recoverable conflicts. Preview a short single-subject set using compatible practice evidence: due recall first, then unseen work in weak lessons and the foundation sequence. Exclude reserved exam questions, expose transparent estimates and reasons, and freeze the actual budget and selection when an idempotent start is confirmed. Study permits tracked hints without granting topic completion or exam readiness.

Record only explicit visible-time intervals anchored to a fresh server clock and monotonic elapsed time. Preserve intervals across recovery without inferring offline or hidden gaps. Bound and merge them on the server, finalize once with the assessment, and union real UTC intervals across sessions so overlaps cannot multiply daily credit. Older missing recordings remain unknown. Reading a goal, editing preferences, opening a set, and saving drafts cannot grant time credit.

Cycle 11 migration verification: the existing local database upgrades from 0007 to 0008, and an empty database upgrades through all revisions to 0008. A SQLite backup was saved first. The API was stopped before model changes and restarted once after migration. New finalized time fields are nullable for older sessions; default preference reads do not create a stored row.

Cycle 11 review improvements: preserve due→weak→next ordering when assigning study work; validate unsupported budgets consistently before replay; freeze raw versus effective options; and compare both draft and hint revisions when finalizing so a concurrent time backup cannot be omitted. Visible recording resumes after browser back/forward cache restoration without counting the hidden gap, and periodic checkpoints use current answer references. A preference conflict refreshes the parent goal and preview while preserving unsaved fields and active answer nodes. Study labels distinguish its estimated budget from the assignment expiry.

Cycle 11 time verification: 25 independent pure tests cover strict UTC parsing, lifetime and two-hour bounds, overlapping and adjacent segments, missing versus zero time, idempotent merges, bounded partial recordings, cross-session union, fractional-second rounding, and exact UTC midnight splits. The full backend suite passes all 531 tests with clean Ruff and mypy. The full frontend suite passes all 384 tests with clean ESLint, formatting, and TypeScript; all 544 static pages and the dynamic UUID viewer build for production.

Cycle 11 live evidence: default preference/plan reads created no preference row or time credit. Two-tab edits produced revisions 1 and 2, preserved a stale tab's unsaved ten-minute budget on 409, and saved it only after explicit resolution at revision 3. Defaults were restored at revision 4. A five-minute probability preview assigned three practice questions estimated at 4½ minutes. Raw text and a revealed hint survived a reload and a changed preview without replacing that active set. Completion saved three correct answers, including two independently correct and one assisted, and 136 seconds across four real visible intervals. Daily credit changed from zero to 2m16s only on completion, retained five older sessions with unknown duration, and stayed exactly 136 seconds on an idempotent submission retry. The profile now has 49 graded answers, 47 correct; probability still has zero progress rows and no qualifying lesson. Its next five-minute plan correctly selects one due recall and two weak-lesson questions.

Cycle 11 remote verified at `8cdcdf9f9e232fc625b9410a1568ed11a3537495` on `main`. GitHub Actions passed for backend, frontend, and Docker configuration: https://github.com/akashew32/BrainHub/actions/runs/43360600058. Eleven of twenty improvement cycles are complete; cycles 12–20 remain part of the active goal.

Next proposed batch (cycle 12): author 120 finite alternate practice forms, four per lesson across four distinct original practice families. Preserve the original 300 questions and 60 reserved exam items. Assign one current form from each of the eight canonical practice families, avoiding an immediately repeated form when another exists. Preserve older valid passes through family coverage and per-form semantic checks; reject duplicate-family sets and cross-session cherry-picking. Keep frozen physical questions for grading and history, deduplicate families within review/study sets, and distinguish extra forms from extra concepts. Alternate tasks must stay within each lesson's taught objectives and receive independent mathematical checks and editorial review.
