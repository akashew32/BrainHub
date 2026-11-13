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
| 2 | Stronger mathematical input handling and answer previews | Verified; publishing | 239 backend tests, 183 frontend tests, 107 shared input fixtures, full build, live 8/8 expression grading |
| 3 | Structured proof builder and proof-specific feedback | Pending | |
| 4 | Per-question hints with assisted/independent mastery | Pending | |
| 5 | Spaced review scheduling and daily retrieval practice | Pending | |
| 6 | Mistake notebook and concept-level performance | Pending | |
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
