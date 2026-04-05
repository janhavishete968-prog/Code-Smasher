# QuantSolve - Algebraic Parser & Equation Engine

QuantSolve is a hackathon-ready financial allocation engine that parses linear equations from text and finds whole-number allocations without using `eval`, `exec`, or math libraries.

## What It Solves

- Single variable equations
- Two-variable allocation equations
- Multi-variable portfolio equations
- Constraint-based filtering (`x > 5`, `y <= 3`, `c must be even`)
- Parentheses and precedence (BODMAS/PEMDAS)
- Infinite-family warning when limits are not applied
- No-solution detection

## Core Rules Implemented

- Parser is handwritten (tokenizer + recursive descent expression parser)
- Solver is handwritten (pruned recursive search on integer space)
- No dynamic code execution (`eval`/`exec`) and no symbolic math libraries
- Whole-number solutions only
- Default financial interpretation uses non-negative allocations

## Input & Output Examples

Your engine parses and solves scenarios from simple to highly complex.

### Example 1 (The Basics)

- User types: `50x = 200`
- Engine outputs: `[x = 4]`

### Example 2 (Two Variables)

- User types: `10x + 20y = 100` (with standard non-negative limits)
- Engine outputs:
	- `[x=10, y=0]`
	- `[x=8, y=1]`
	- `[x=6, y=2]`
	- `[x=4, y=3]`
	- `[x=2, y=4]`
	- `[x=0, y=5]`

### Example 3 (Many Variables - The Real Challenge)

- User types: `10a + 15b + 20c + 50d + 5e = 1000`
- Engine outputs: Calculates and lists all valid 5-way combinations that exactly equal 1000.
- Verified run in this project: `337212` valid allocations.

### Example 4 (Applying Market Rules)

- User types: `10x + 20y + 5z = 100`
- Rules added via UI: `x > 5, y < 3`
- Engine outputs: Only combinations that strictly obey those greater-than/less-than limits.
- Verified run in this project: `9` valid allocations.

### Example 5 (Brackets and Order of Operations)

- User types: `((10x + 20y) * 2) + 5z = 500`
- Engine outputs: Parser respects BODMAS/PEMDAS and solves after evaluating brackets and multiplication.
- Verified run in this project: `182` valid allocations.

### Example 6 (Impossible Math)

- User types: `2x + 4y = 3`
- Engine outputs: `No whole number solutions exist.`

### Infinity Warning Case

- User types: `x + y = 100` with no constraints
- Engine outputs: `Infinite answers detected. Please apply market limits.`

## UI Features

- Landing page route at `/` with CTA to solver and Google login
- Solver route at `/app`
- Equation input field
- Constraints input field
- Visual rule builder (dropdown-based compare/even rules)
- Demo scenario dashboard
- Parsed equation summary
- Results table with recommendation tagging
- Google authentication (Firebase Auth)
- User-based history storage (Firestore)
- Truncation and performance status messaging
- UI row cap for smooth rendering on large result sets

Constraint parser also accepts user-friendly labels such as `Asset A > 0` and
`Asset C must be even`.

## Tech Stack

- Frontend: React + Vite
- Solver/Parser: JavaScript (`src/utils/solver.js`)
- Tests: Node scripts (`scripts/smoke-test.mjs`, `scripts/stress-test.mjs`)

## Run Locally

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Firebase Setup

1. Copy `.env.example` to `.env`.
2. Fill all `VITE_FIREBASE_*` variables from your Firebase project.
3. In Firebase console:
	- Enable Google sign-in in Authentication.
	- Create Firestore database.

Without Firebase keys, solver features still work, but login/history are disabled.

### Start Dev Server

```bash
npm run dev
```

### Quality Checks

```bash
npm run lint
npm run test:smoke
npm run test:stress
```

### Production Build

```bash
npm run build
npm run preview
```

## Deployment (Static Hosting)

Build output is generated in `dist/` and can be deployed to Vercel, Netlify, GitHub Pages, or any static host.

Standard deploy flow:

1. Install dependencies: `npm ci`
2. Build: `npm run build`
3. Publish `dist/`

## Validation Status

Current repository checks pass:

- ESLint: pass
- Smoke tests: pass
- Stress tests: pass
- Vite production build: pass

## Notes for Judges

- Parser correctness: custom tokenizer and parser with explicit syntax checks
- Performance: recursive solver with pruning, GCD checks, finite bounds, iteration caps, and truncation safeguards
- Error handling: invalid syntax, division by zero, unsupported non-linear forms, oversized search spaces
