# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 14 SaaS boilerplate (based on ShipFast) with Stripe payments, Supabase authentication, and email integration. The project uses the App Router architecture with Server Components.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Generate sitemap (runs automatically after build)
npm run postbuild
```

## Core Architecture

### Authentication Flow
- **Provider**: Supabase Auth with OAuth support
- **Middleware**: `/middleware.js` refreshes user sessions on every request
- **Protected Routes**: `/app/dashboard/layout.js` wraps all `/dashboard/*` routes and redirects unauthenticated users to `/signin`
- **Client-side**: `/libs/api.js` intercepts 401 errors and redirects to login

### Payment Integration
- **Checkout Flow**:
  1. `<ButtonCheckout />` calls `/api/stripe/create-checkout`
  2. API creates Stripe session with `client_reference_id` (user ID)
  3. User completes payment on Stripe
  4. Webhook at `/api/webhook/stripe` receives events and updates `profiles` table

- **Webhook Events Handled**:
  - `checkout.session.completed`: Grant access, save customer_id and price_id
  - `invoice.paid`: Renew access for recurring subscriptions
  - `customer.subscription.deleted`: Revoke access
  - `invoice.payment_failed`: Optional handling (Stripe auto-retries)

- **Customer Portal**: `/api/stripe/create-portal` generates Stripe portal sessions for subscription management

### Database Schema (Supabase)
- **profiles table**: Core user data
  - `id` (matches Supabase auth user ID)
  - `email`
  - `customer_id` (Stripe customer ID)
  - `price_id` (Stripe price ID for plan)
  - `has_access` (boolean for access control)

### Configuration System
- **Central config**: `/config.js` contains all app settings
  - App metadata (name, description, domain)
  - Stripe plans array (priceId, name, price, features)
  - Mailgun settings (from emails, support email)
  - Auth URLs (login, callback)
  - Crisp chat config
  - Theme/color settings

### Email System
- **Provider**: Mailgun (configured in `/libs/mailgun.js`)
- **Inbound webhook**: `/api/webhook/mailgun` handles incoming emails
- **Key emails**:
  - `fromNoReply`: Magic login links
  - `fromAdmin`: Updates, abandoned carts
  - `supportEmail`: Customer support (forwards to `forwardRepliesTo`)

### Styling
- **Framework**: Tailwind CSS + DaisyUI
- **Themes**: Light and dark modes in `/tailwind.config.js`
- **Theme color**: Set in `config.js` via `config.colors.theme` and `config.colors.main`
- **Custom animations**: Defined in Tailwind config (shimmer, wiggle, popup, etc.)

### Client-Side Wrappers
- **LayoutClient** (`/components/LayoutClient.js`): Wraps app with:
  - Crisp chat support (shown/hidden based on routes)
  - Toast notifications (react-hot-toast)
  - Tooltips
  - Top loading bar (nextjs-toploader)

### API Client Pattern
- **Usage**: Import `apiClient` from `/libs/api.js` for internal API calls
- **Features**:
  - Automatic error handling with toast notifications
  - 401 redirects to login
  - 403 shows "Pick a plan" message
  - Returns `response.data` directly

### Blog System
- **Content**: Defined in `/app/blog/_assets/content.js`
- **Structure**:
  - Articles array with slug, title, description, content (JSX)
  - Categories array for organization
  - Authors array with bio, avatar, socials
- **Routes**:
  - `/blog` - All articles
  - `/blog/[articleId]` - Individual article
  - `/blog/category/[categoryId]` - Filtered by category
  - `/blog/author/[authorId]` - Filtered by author
- **Styling**: Reusable styles object in content.js for consistent article formatting

### SEO
- **Helper**: `/libs/seo.js` - `getSEOTags()` function
- **Usage**: Export metadata from page.js files
- **Sitemap**: Auto-generated with `next-sitemap` after builds

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Mailgun
MAILGUN_API_KEY=

# Optional
CRISP_WEBSITE_ID=
```

## Common Patterns

### Adding a New Protected Route
1. Create page under `/app/dashboard/*`
2. Authentication is automatic (inherited from dashboard layout)

### Adding a New Stripe Plan
1. Create plan in Stripe dashboard
2. Add plan object to `config.stripe.plans` array with priceId
3. Update webhook logic if custom behavior needed

### Adding a New API Route
1. Create route at `/app/api/[name]/route.js`
2. Export POST/GET/etc functions
3. Use `createRouteHandlerClient()` from Supabase for auth
4. Return `NextResponse.json()`

### Creating a New Blog Article
1. Add article object to `articles` array in `/app/blog/_assets/content.js`
2. Include required fields: slug, title, description, categories, author, publishedAt, image, content
3. Content is JSX - use predefined styles from styles object

## Important Notes

- The middleware runs on EVERY route to refresh Supabase sessions
- Stripe webhook endpoint must be added in Stripe dashboard (points to `/api/webhook/stripe`)
- Customer portal must be configured in Stripe settings before using portal route
- Image domains must be whitelisted in `next.config.js` for Next.js `<Image>` component
- Use Server Components by default; only add 'use client' when needed for interactivity
- The `config.js` file is imported throughout the codebase - update it instead of hardcoding values
