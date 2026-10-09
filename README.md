# BrainHub

BrainHub is a dark-mode-first training platform for quantitative trading interviews. It turns mental math, estimation, probability, reaction speed, pattern recognition, and market intuition into short, repeatable practice sessions with useful feedback rather than novelty scores.

> Screenshot placeholder: run the app and capture the responsive training floor at `http://localhost:3000`.

## What is included

- **Pattern Recognition** — original geometric cards, guaranteed playable boards, all-same/all-different validation, streak scoring, and property-level explanations after mistakes.
- **Market Making** — seeded hidden fair values, informed/noisy counterparties, two-sided quotes, inventory and cash accounting, mark-to-market PnL, adverse selection, spread and calibration analysis.
- **Mental Math** — keyboard-first generated arithmetic, fractions/percentages, powers and trading PnL with difficulty-aware ranges.
- **Reaction** — simple, choice, and go/no-go modes using `performance.now()`, randomized waits, false-start penalties, median/best/consistency statistics.
- **Fermi Estimation** — 40 curated questions with defensible ranges and decompositions, scored by logarithmic error rather than false precision.
- **Liar's Dice** — one human and three strong computer opponents, five dice each, wild ones, legal bid ordering, elimination, probability-driven challenges, strategic raises, and post-round analysis.
- **Optimal Stopping** — sequential dice, finite card-deck, and no-recall search problems scored with exact stop/continue expected values and state-by-state EV-regret review.
- **Probability Betting** — generated take/pass, fair-price, odds-conversion, and Kelly-sizing drills that separate decision quality from realized outcomes.
- **Auction Arena** — repeated first-price, second-price, and common-value auctions against rational bidders, with bidding-region guidance and winner's-curse analysis.
- **Bayesian Trader** — sequential coin, abstract-signal, and fictional market-regime updates scored with posterior error, Brier score, and final trading EV.
- **Order Book Challenge** — integer-tick limit-order books for spread, depth-sweep, limit-insertion, imbalance, execution-cost, and inventory questions.
- **Sequential Strategy** — exact take-away solvers, Penney-style coin races, and non-transitive dice games against opponents using backward induction or exhaustive comparison.

## Architecture

```text
frontend/                 Next.js App Router, React, strict TypeScript, Tailwind
  app/                    Pages, layouts, global styling
  components/games/       Isolated playable game modules and shared shell
  lib/games.ts            Central frontend game registry
  tests/                  Vitest game-utility tests
backend/                  FastAPI, Pydantic, SQLAlchemy, Alembic
  app/api/                REST session, action, completion, stats APIs
  app/games/              Shared engine protocol and isolated game engines
    optimal_stopping.py   Bellman recursion for finite stopping problems
    probability_betting.py EV, odds, Kelly, and logarithmic scoring
    auction.py            Auction settlement and benchmark strategies
    bayesian.py           Posterior updates, Brier scoring, and action EV
    order_book.py         Integer-tick book mutations, sweeps, and PnL
    sequential_strategy.py Exact take-away and sequence-game solvers
    market_order_flow.py  Counterparty policy kept separate from simulation
    market_scoring.py     Risk-adjusted market score and analysis metrics
  app/db/                 Models, sessions, catalog/demo seeding
  app/services/           Attempt and aggregate-statistics services
  tests/                  pytest engine and API tests
```

The browser handles latency-sensitive drills whose answers contain no privileged state. Market Making and Liar's Dice are authoritative on the backend: fair values and opponent dice are filtered from public session state. Engines accept explicit seeds for reproducible tests and bug reports.

Attempts persist score, difficulty, duration, win/loss, timestamp, and flexible game-specific metrics. `UserGameStats` maintains personal bests, rolling averages, attempt counts, and training time. The initial identity is a durable local guest designed to be replaceable by Clerk or Auth.js without changing game records.

## Quick start with Docker

Requirements: Docker with Compose.

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`. The API and interactive OpenAPI docs are at `http://localhost:8000` and `http://localhost:8000/docs`.

The Compose stack contains only PostgreSQL, FastAPI, and Next.js—there is no Redis because the initial architecture does not need it.

## Native development

Requirements: Python 3.12+, Node.js 22+, pnpm, and PostgreSQL 17+.

```bash
# Terminal 1: database
docker compose up -d db

# Terminal 2: backend
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
python -m app.db.seed --demo   # optional representative history
uvicorn app.main:app --reload

# Terminal 3: frontend
cd frontend
pnpm install
pnpm dev
```

Copy `.env.example` to `.env`. `DATABASE_URL` selects PostgreSQL, `CORS_ORIGINS` controls browser origins, `DEMO_USER_NAME` names the local profile, and `BACKEND_URL` points the Next.js same-origin proxy to FastAPI. The backend defaults to SQLite only as a frictionless fallback; production/local Compose uses PostgreSQL.

## APIs

- `GET /api/games`
- `POST /api/games/{slug}/sessions`
- `POST /api/games/{slug}/sessions/{id}/actions`
- `POST /api/games/{slug}/sessions/{id}/complete`
- `GET /api/attempts/recent`
- `GET /api/stats`
- `GET /api/stats/{slug}`

## Quality commands

```bash
cd backend
ruff check .
ruff format --check .
mypy app
pytest

cd ../frontend
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build

# From repository root
docker compose config --quiet
```

GitHub Actions runs these gates on pushes and pull requests.

## Liar's Dice rules and AI

Four players start with five private six-sided dice. A bid is a quantity and face, and raises are lexicographic: increase quantity, or keep quantity and increase face. A challenge reveals all dice. Ones count as wild for faces two through six; bids on ones count only literal ones. If the bid has enough matches the challenger loses a die, otherwise the bidder does. The loser opens the next round; the last player holding dice wins.

Bots compute the exact binomial probability that a bid is true, conditioning on their private dice and the number of unknown dice. Personality-specific challenge thresholds create conservative, balanced, and aggressive styles without replacing rational play. Legal candidate raises are scored by probability and exposure, so obvious impossible bids are avoided. Post-round analysis reports the information-set probability and whether the challenge was statistically justified.

## Quant solver notes

The new drills use deterministic seeds so a scenario can be replayed and a failing case can be reproduced. Scores emphasize the quality of the decision rather than the luck of the realized outcome.

- **Optimal Stopping:** finite dice and card states use the Bellman recurrence `V(state) = max(EV(stop), EV(continue))`. Card draws recurse over the remaining deck without replacement; finite search compares the current offer with the backward-inducted continuation value. Reviews report regret as `EV(optimal) - EV(chosen)`.
- **Probability Betting:** take/pass questions use expected profit, price estimates use logarithmic relative-error scoring, odds use reciprocal conversions, and sizing compares the answer with the full-Kelly benchmark. Full Kelly is presented as analysis, not as a universal wagering recommendation.
- **Auction Arena:** first-price private-value guidance uses the symmetric uniform benchmark `(n-1)/n × value`; second-price feedback explains truthful bidding under standard independent private values. Common-value bots shade noisy signals to account for the selection effect behind the winner's curse.
- **Bayesian Trader:** every signal applies normalized Bayes updating. Probability estimates receive continuous posterior-error and Brier scoring; the final BUY/SELL/HOLD choice is evaluated by its expected payoff under the posterior.
- **Order Book Challenge:** all prices are integer ticks internally. Market orders consume best prices first and support partial fills; spread, midpoint, average execution price, marked PnL, insertion, and cancellation are covered by unit tests.
- **Sequential Strategy:** deterministic perfect-information states use memoized backward induction. Coin races use exact Penney-response structure, and the non-transitive dice opponent exhaustively compares all face pairs before choosing a counter-die.

## Adding a game

The dashboard and static routes discover games through registries rather than duplicated navigation lists.

1. Add metadata to `frontend/lib/games.ts` and `backend/app/games/registry.py`.
2. For local drills, create a focused component in `frontend/components/games/` and register it in `frontend/app/games/[slug]/page.tsx`.
3. For authoritative state, implement `GameEngine.create_session`, `apply_action`, and `public_state`, then add the engine class to `ENGINES` in `backend/app/api/routes.py`.
4. Record an attempt through the generic completion endpoint and add engine plus UI utility tests.

A minimal backend engine looks like:

```python
class CalibrationEngine(GameEngine):
    def create_session(self, difficulty):
        return {"target": self.rng.randrange(100), "score": 0}

    def apply_action(self, state, action):
        state["score"] = max(0, 100 - abs(action["guess"] - state["target"]))
        return state

    def public_state(self, state):
        return {key: value for key, value in state.items() if key != "target"}
```

No dashboard rewrite or global-navigation edit is required.

## Roadmap

- Optional account authentication and cloud profile synchronization
- Shared seeded replay links and interview playlists
- Expanded per-category rating calibration as attempt volume grows
- More probability, options, order-book, and sequential-decision games
- Accessibility testing with additional assistive-technology combinations

The current rating is intentionally transparent: an 800-point baseline plus capped contributions from average scores and training volume. It can evolve without changing persisted attempts.
