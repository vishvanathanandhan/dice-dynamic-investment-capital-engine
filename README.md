# DICE — Dynamic Investment Capital Engine

**An India-focused mutual fund suitability discovery and investor behavioural profiling prototype, combining NISM Series V-A concepts, deterministic decision logic and Generative AI.**

[Live Application](https://dice-engine.ai.studio) · [GitHub Repository](https://github.com/vishvanathanandhan/dice-dynamic-investment-capital-engine)

---

## Project Overview

DICE (Dynamic Investment Capital Engine) is an independent FinTech side project developed to explore how mutual fund knowledge, structured investor profiling and Generative AI can be brought together in an interactive application.

The platform uses a questionnaire to assess an investor's risk capacity, risk willingness and investment preferences. Its rules-based DICE Engine evaluates the responses, applies scheme eligibility and suitability checks, and ranks matching mutual fund schemes. Google Gemini is integrated to provide contextual explanations and summaries.

The project was conceptualised using financial concepts studied through **NISM Series V-A – Mutual Fund Distributors** and developed with AI-assisted tools, including **Google AI Studio**. The application is an educational prototype and should not be treated as an investment recommendation service.

## Project Objectives

- Translate mutual fund and investor-profiling concepts into a working software prototype.
- Assess investor risk capacity and risk willingness through a structured questionnaire.
- Classify investor profiles using predefined application rules.
- Apply eligibility checks and suitability scoring to mutual fund schemes.
- Rank and present up to three matching schemes.
- Use Generative AI to explain selected behavioural concepts and summarise matching results.
- Demonstrate a practical application of Finance, Business Analytics and Generative AI.

## Key Features

| Feature | Description |
|---|---|
| Investor questionnaire | Collects responses about investor circumstances, preferences and behaviour. |
| Risk profiling | Calculates risk-capacity and risk-willingness scores and combines them into an overall profile score. |
| Behavioural insights | Identifies behavioural biases and provides related guidance. |
| Investor classification | Maps the calculated profile to a predefined risk category. |
| Scheme eligibility | Applies programmed eligibility checks to the available scheme records. |
| Suitability matching | Evaluates scheme attributes against the investor profile and preferences. |
| Scheme ranking | Returns up to three leading eligible matches based on the DICE scoring logic. |
| AI-assisted explanations | Uses Gemini for contextual explanations, with deterministic fallback responses when AI is unavailable. |
| Scheme tools | Includes scheme comparison, watchlist, scheme details and calculator-related interface modules. |
| Data pipeline | Processes AMFI NAV data and scheme disclosure information and exposes data-quality and pipeline endpoints. |

> **Methodology note:** The risk-score weighting, classification thresholds, eligibility criteria and matching weights are implementation choices within this prototype. They are not official NISM formulas or SEBI-approved suitability rules.

## How the DICE Engine Works

1. **Investor inputs** — The user completes the profiling questionnaire.
2. **Profile calculation** — The engine calculates risk-capacity and risk-willingness scores.
3. **Risk classification** — The combined score is mapped to a predefined investor category.
4. **Eligibility assessment** — Available schemes are checked against the prototype's eligibility rules.
5. **Suitability evaluation** — Eligible schemes are scored against the investor profile and preferences.
6. **Ranking** — The engine sorts the eligible results and returns up to three leading matches.
7. **Explanation** — Gemini may provide contextual explanations and summaries. Core scoring and matching remain in deterministic application logic.

## AI and Decision-Logic Architecture

DICE uses a hybrid approach. The application does not delegate its core suitability calculations to a generative model.

### Deterministic DICE Engine

The TypeScript decision engine handles:

- Risk-capacity and risk-willingness calculations.
- Overall investor risk scoring and categorisation.
- Scheme eligibility checks.
- Scheme suitability evaluation and scoring.
- Ranking of eligible scheme matches.

### Google Gemini Integration

The backend integrates the Google GenAI SDK and uses the `gemini-3.1-flash-lite` model for selected explanation and summary tasks. The server includes deterministic fallback behaviour for cases where Gemini is not configured or cannot return a response.

**Google AI Studio** was used as an AI-assisted development environment. It is distinct from the runtime framework and does not replace the application's React, TypeScript, Node.js or Express components.

## Technology Stack

| Technology | Role in the project |
|---|---|
| React 19 | Frontend user interface |
| TypeScript | Application and decision-engine logic |
| Node.js | Backend runtime |
| Express | API server |
| Vite | Development tooling and frontend build |
| Tailwind CSS 4 | Styling and interface utilities |
| Google GenAI SDK | Gemini API integration |
| Google Gemini | AI-assisted explanations and summaries |
| XLSX | Spreadsheet data processing |
| LocalStorage | Client-side persistence where implemented |

## Data Processing and Limitations

The source includes a data pipeline for processing AMFI NAV records and mutual fund scheme disclosure information. It also includes pipeline statistics, scheme-query and data-quality endpoints.

Data ingestion alone does not guarantee that every scheme field is complete, current or independently verified. Before relying on any displayed scheme information, users should check the relevant official AMC, AMFI and SEBI publications.

**Performance-data caution:** Any illustrative or synthetic return or risk metrics in the prototype must not be interpreted as actual historical fund performance. Historical performance claims should only be presented when they are calculated from verified historical NAV and benchmark data, with the data source and observation period clearly identified.

## Run Locally

### Prerequisites

- Node.js (use a currently supported LTS release where possible)
- npm
- A Google Gemini API key for Gemini-powered features (optional; deterministic fallback responses are available for supported flows)

### 1. Clone the repository

```bash
git clone https://github.com/vishvanathanandhan/dice-dynamic-investment-capital-engine.git
cd dice-dynamic-investment-capital-engine
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the Gemini API key

The backend loads environment variables using `dotenv`. For a local setup, create a `.env` file in the project root and add:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Replace the placeholder with your own key. Do not commit `.env`, `.env.local`, or any file containing a real API key. The repository includes `.env.example` as a configuration reference; it is not a place to store a real secret.

When deploying outside Google AI Studio, configure `GEMINI_API_KEY` in the deployment platform's private environment-variable or secret settings. AI Studio secrets do not automatically transfer to another hosting provider.

### 4. Start the development server

```bash
npm run dev
```

The Express server starts the application and Vite middleware. In the current source configuration, the default local address is:

```text
http://localhost:3000/
```

If the default port is already in use, configure a different `PORT` environment variable.

### 5. Build the frontend

```bash
npm run build
```

### Other available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts the development server through `tsx server.ts`. |
| `npm start` | Starts the server through `tsx server.ts`. |
| `npm run build` | Runs the Vite production build. |
| `npm run preview` | Starts Vite's preview server. |
| `npm run lint` | Runs the TypeScript compiler in no-emit mode. |

## API Overview

The Express backend defines the following application routes:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/schemes` | Returns the bundled mutual fund scheme records. |
| `GET` | `/api/questions` | Returns the investor questionnaire. |
| `POST` | `/api/dice/explain` | Returns behavioural guidance and, where available, Gemini-enhanced explanation. |
| `POST` | `/api/dice/match` | Calculates the investor profile and scheme matches. |
| `POST` | `/api/calculate` | Runs the calculator endpoint. |
| `GET` | `/api/pipeline/stats` | Returns pipeline statistics. |
| `GET` | `/api/pipeline/schemes` | Queries pipeline scheme records. |
| `GET` | `/api/pipeline/scheme/:code` | Retrieves a scheme by code. |
| `GET` | `/api/pipeline/data-quality` | Returns data-quality issues. |
| `GET` | `/api/pipeline/heatmap` | Returns category heatmap data. |
| `POST` | `/api/pipeline/sync` | Triggers the pipeline sync endpoint. |

## Repository Structure

```text
dice-dynamic-investment-capital-engine/
├── .github/                 # GitHub Actions workflow
├── public/
│   └── funds_master.json    # Bundled scheme master data
├── scripts/                 # Data verification script
├── server/
│   └── pipelineService.ts   # Server-side pipeline services
├── src/
│   ├── components/          # React interface components
│   ├── context/             # Application contexts
│   ├── data/                # Questionnaire and scheme data
│   ├── engine/              # Deterministic DICE matching engine
│   ├── types/               # TypeScript types
│   ├── utils/               # Data processing utilities
│   ├── App.tsx              # Main application component
│   ├── index.css            # Global styles
│   └── main.tsx             # Frontend entry point
├── .env.example             # Environment-variable template
├── .gitignore               # Git exclusions
├── index.html
├── package.json
├── package-lock.json        # npm lockfile, if included in the checkout
├── server.ts                # Express server and API routes
├── tsconfig.json
└── vite.config.ts
```

## Project Background

DICE is an independent side project at the intersection of Finance, Business Analytics and Artificial Intelligence. It was developed from an individual idea and financial-market learning, supported by NISM Series V-A concepts and AI-assisted development using Google AI Studio and prompt engineering.

The project demonstrates an attempt to translate domain knowledge into a working software prototype, while separating deterministic financial decision logic from generative AI explanations.

## Disclaimer

DICE is an independent educational and experimental prototype. It is not registered with SEBI as an Investment Adviser, and it is not presented as an authorised mutual fund distribution service. The application does not provide regulated investment advice, guarantee returns or assure the suitability of any scheme for a particular person.

The questionnaire, profile categories, scores, eligibility conditions and matching results are prototype outputs. They should not be relied upon as the sole basis for an investment decision. Mutual fund investments are subject to market risks. Users should read the relevant scheme information documents and verify current information through official sources, and consult an appropriately qualified professional where necessary.

---

**DICE — Dynamic Investment Capital Engine**  
*An independent FinTech prototype exploring the intersection of financial knowledge, deterministic decision systems and Generative AI.*
