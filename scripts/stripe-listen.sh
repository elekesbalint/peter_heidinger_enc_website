#!/usr/bin/env bash
# Forward Stripe webhooks to local Next.js. Requires STRIPE_SECRET_KEY in .env.
# On first run, copy the printed "webhook signing secret" into STRIPE_WEBHOOK_SECRET.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
# shellcheck disable=SC1091
[ -f .env ] && . ./.env
set +a
exec stripe listen \
  --forward-to localhost:3000/api/stripe/webhook \
  --events checkout.session.completed \
  --api-key "${STRIPE_SECRET_KEY:?Set STRIPE_SECRET_KEY in .env}"
