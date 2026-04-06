# AdriaGo Mobile (Expo)

Initial mobile MVP scaffold for iOS/Android.

## Setup

1. Copy env template:
   - `cp .env.example .env`
2. Fill values in `.env`.
3. Start dev server:
   - `npm run start`

## Current MVP scope

- Supabase auth (login/register) with secure local session storage.
- Optional referral token during registration (`/api/referrals/attach` call).
- Quick actions that open existing web flows in an in-app browser:
  - Dashboard
  - Device order
  - Topup
  - Referral section

## Next steps

- Native dashboard data/API integration.
- Native order/topup forms + deep-link return from Stripe.
- Push notifications and release pipeline.

