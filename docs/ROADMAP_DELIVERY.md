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
| 7 | Exam readiness, blueprint, and prerequisite evidence | Pending | |
| 8 | Exam integrity, retry policy, and robust session lifecycle | Pending | |
| 9 | Learning dashboard and recent learning history | Pending | |
| 10 | Diagnostic placement across foundation topics | Pending | |
| 11 | Personalized study sessions and time goals | Pending | |
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
