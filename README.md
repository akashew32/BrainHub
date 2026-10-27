# BrainHub

BrainHub is a dark-mode-first training platform for quantitative trading interviews and programming fluency. It turns mental math, estimation, probability, reaction speed, market intuition, and core language knowledge into short, repeatable practice sessions with useful feedback rather than novelty scores.

> Screenshot placeholder: run the app and capture the responsive training floor at `http://localhost:3000`.

## What is included

- **Pattern Recognition** — original geometric cards, guaranteed playable boards, all-same/all-different validation, streak scoring, and property-level explanations after mistakes.
- **Market Making** — seeded hidden fair values, informed/noisy counterparties, two-sided quotes, inventory and cash accounting, mark-to-market PnL, adverse selection, spread and calibration analysis.
- **Mental Math** — keyboard-first generated arithmetic, fractions/percentages, powers and trading PnL with difficulty-aware ranges.
- **Reaction** — simple, choice, and go/no-go modes using `performance.now()`, randomized waits, false-start penalties, median/best/consistency statistics.
- **Fermi Estimation** — 40 curated questions with defensible ranges and decompositions, scored by logarithmic error rather than false precision.
- **Liar's Dice** — one human and three strong computer opponents, five dice each, wild ones, legal bid ordering, elimination, probability-driven challenges, strategic raises, and post-round analysis.
- **Bayesian Updating** — prior, sensitivity, and specificity drills covering positive and negative evidence without base-rate neglect.
- **Expected Value** — probability-weighted trading outcomes, asymmetric payoffs, and execution-cost-adjusted edge calculations.
- **Order Book** — top-of-book midpoint/spread questions plus multi-level market-order VWAP and price-impact practice.
- **Options Payoff** — call and put intrinsic value, premiums, long/short direction, and full contract multipliers.
- **Portfolio Risk** — two-asset volatility calculations that make the contribution of weights, covariance, and correlation explicit.

The separate **Programming Trivia** desk at `/programming` includes 1,200 questions—200 each for Java, Python, C++, important Python libraries, computer architecture, and SQL. Rounds deliberately sample distinct concepts to keep repeat sessions varied. Python questions cover the language, standard and general-purpose libraries, containers, iteration, strings, and built-ins without machine-learning libraries.

The **Coding Challenges** lab at `/challenges` contains 120 free LeetCode-indexed algorithm problems—20 easy, 50 medium, and 50 hard—plus 30 original low-level design exercises. None of the algorithm selections are in the current NeetCode 150. Every challenge has original BrainHub guidance, starter code for Python, Java, and C++, three visible examples, and 20 deterministic test cases, for 3,000 verified cases in total. Run checks three cases quickly; Submit checks all 20. The editor inserts four spaces when Tab is pressed.

The **Learning Roadmaps** page at `/roadmaps` exposes coming-soon entry cards for Probability, Linear Algebra, Calculus, Real Analysis, and Discrete Math. The five curricula are intentionally not implemented yet.

Challenge code is executed by the public [Judge0 CE](https://ce.judge0.com/) sandbox, so source code entered in the lab is sent to that third-party service. Do not paste secrets or proprietary code into the editor.

## Architecture

```text
frontend/                 Next.js App Router, React, strict TypeScript, Tailwind
  app/                    Pages, layouts, global styling
  components/games/       Isolated playable game modules and shared shell
    quant-drill.tsx       Shared lifecycle, scoring, explanations, and persistence for calculation drills
  components/challenges/  Searchable catalog and three-language coding workbench
  lib/games.ts            Central frontend game registry
  tests/                  Vitest game-utility tests
backend/                  FastAPI, Pydantic, SQLAlchemy, Alembic
  app/api/                REST session, action, completion, stats APIs
  app/challenges/         Challenge catalog and Judge0 execution harnesses
  app/games/              Shared engine protocol and isolated game engines
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

Copy `.env.example` to `.env`. `DATABASE_URL` selects PostgreSQL, `CORS_ORIGINS` controls browser origins, `DEMO_USER_NAME` names the local profile, and `NEXT_PUBLIC_API_URL` points the browser to FastAPI. The backend defaults to SQLite only as a frictionless fallback; production/local Compose uses PostgreSQL.

## APIs

- `GET /api/games`
- `POST /api/games/{slug}/sessions`
- `POST /api/games/{slug}/sessions/{id}/actions`
- `POST /api/games/{slug}/sessions/{id}/complete`
- `GET /api/attempts/recent`
- `GET /api/stats`
- `GET /api/stats/{slug}`
- `POST /api/challenges/{slug}/run`

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
python tools/generate_challenges.py
python tools/generate_extended_trivia.py
python tools/verify_challenge_sources.py
python tools/verify_challenge_runner.py
```

GitHub Actions runs these gates on pushes and pull requests.

## Liar's Dice rules and AI

Four players start with five private six-sided dice. A bid is a quantity and face, and raises are lexicographic: increase quantity, or keep quantity and increase face. A challenge reveals all dice. Ones count as wild for faces two through six; bids on ones count only literal ones. If the bid has enough matches the challenger loses a die, otherwise the bidder does. The loser opens the next round; the last player holding dice wins.

Bots compute the exact binomial probability that a bid is true, conditioning on their private dice and the number of unknown dice. Personality-specific challenge thresholds create conservative, balanced, and aggressive styles without replacing rational play. Legal candidate raises are scored by probability and exposure, so obvious impossible bids are avoided. Post-round analysis reports the information-set probability and whether the challenge was statistically justified.

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
- Multi-asset portfolio construction and path-dependent options exercises
- Accessibility testing with additional assistive-technology combinations

The current rating is intentionally transparent: an 800-point baseline plus capped contributions from average scores and training volume. It can evolve without changing persisted attempts.
