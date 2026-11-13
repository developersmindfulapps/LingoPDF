# Paddle Agent Skills Attribution & Provenance

The skills in this directory are integrated from the official Paddle open-source agent skills repository:
- **Repository**: [https://github.com/PaddleHQ/paddle-agent-skills](https://github.com/PaddleHQ/paddle-agent-skills)
- **Copyright**: Copyright 2026 Paddle.com Market Limited
- **License**: Apache License, Version 2.0 (see [LICENSE](file:///c:/Users/rajat/OneDrive/Documents/Projects/LingoPDF/.agents/skills/LICENSE))

## Integrated Skills (LingoPDF Scope)

| Skill Directory | Skill Name | Scope |
| :--- | :--- | :--- |
| `paddle-catalog-setup` | `paddle-catalog-setup` | Product and price catalog definition, one-time purchases, lifetime licenses |
| `paddle-checkout-web` | `paddle-checkout-web` | Client-side Next.js checkout (overlay/inline), event lifecycle, redirection |
| `paddle-webhooks` | `paddle-webhooks` | Server-side Route Handler, signature unmarshaling, idempotency, order safety |
| `paddle-sandbox-testing` | `paddle-sandbox-testing` | End-to-end sandbox verification, test cards, webhook simulation, refund testing |
| `paddle-pricing-pages` | `paddle-pricing-pages` | Localized price display via Paddle.js `PricePreview`, multi-currency & tax formatting |
| `paddle-onboarding` | `paddle-onboarding` | Paddle account audit against go-live checklist, domain approvals, token verification |

## Excluded Workflows

In accordance with LingoPDF's one-time purchase licensing model, recurring subscription lifecycle and usage-metering skills from the upstream repository have been intentionally omitted:
- `usage-based-billing`
- `subscription-cancel`
- `subscription-sync`
- `subscription-update`
- `customer-portal`
- `billing-history`
