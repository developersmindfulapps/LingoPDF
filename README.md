# LingoPDF

LingoPDF is the website, account platform, licensing backend, and administrative system for a family of paid language-related browser extensions, beginning with the LingoPDF German-to-English PDF Word Translation extension.

> **Note:** This repository exclusively hosts the LingoPDF web application and backend platform. The browser extensions live in separate repositories.

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x` (verified with `v22.22.3`)
- **npm**: `v10.x` or higher (verified with `v10.9.8`)

---

## Getting Started

### 1. Installation

Install all required dependencies:

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file to `.env.local`:

```bash
cp .env.example .env.local
```

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env.local
```

Configure your local environment variables in `.env.local`. Do not commit `.env.local` to version control.

### 3. Run Development Server

Start the local Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js development server on port 3000 |
| `npm run build` | Compiles an optimized production build |
| `npm run start` | Starts the Next.js production server (requires `npm run build`) |
| `npm run lint` | Runs ESLint to check code quality and syntax |
| `npm run typecheck` | Runs TypeScript compiler (`tsc --noEmit`) to verify types |

---

## Project Structure

```text
LingoPDF/
├── public/                 # Static assets (favicons, SVGs, public images)
├── src/
│   ├── app/                # Next.js App Router root
│   │   ├── favicon.ico     # Application favicon
│   │   ├── globals.css     # Global styles & CSS custom property brand tokens
│   │   ├── layout.tsx      # Root layout with Space Grotesk & Inter font setup
│   │   └── page.tsx        # Temporary status verification screen
│   ├── components/         # Reusable React components (ready for future phases)
│   └── lib/                # Shared utilities, database helpers, and library configs
├── .env.example            # Template for environment variables
├── .gitignore              # Git ignore rules for dependencies, env files, and build outputs
├── eslint.config.mjs       # ESLint configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Project manifest, scripts, and dependencies
├── README.md               # Project documentation
└── tsconfig.json           # TypeScript configuration
```

---

## Brand Design Tokens

The following brand palette tokens are configured in `src/app/globals.css`:

- **Warm Ivory**: `#F8F5EE` (`--color-warm-ivory`)
- **Forest Green**: `#193C32` (`--color-forest-green`)
- **Terracotta**: `#D87854` (`--color-terracotta`)
- **Soft Sage**: `#E8E4D9` (`--color-soft-sage`)
- **Charcoal**: `#242923` (`--color-charcoal`)
- **White**: `#FFFFFF` (`--color-white`)

### Typography

- **Headings**: `Space Grotesk` (via `next/font/google`, self-hosted at build time)
- **Body**: `Inter` (via `next/font/google`, self-hosted at build time)
