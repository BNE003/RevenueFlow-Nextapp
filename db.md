# Database Schema

## apps
- id: uuid
- app_id: text
- name: text
- created_at: timestamptz
- updated_at: timestamptz

## devices
- id: uuid
- device_id: text
- app_id: text
- name: text
- first_seen_at: timestamptz
- last_seen_at: timestamptz
- created_at: timestamptz
- updated_at: timestamptz

## purchases
- id: uuid
- app_id: text
- user_id: text
- product_id: text
- transaction_id: text
- purchase_date: timestamptz
- environment: text
- price: numeric
- expiration_date: timestamptz
- is_trial: bool
- device_id: uuid
- created_at: timestamptz
- updated_at: timestamptz

## active_sessions
- id: uuid
- device_id: uuid
- app_id: text
- last_heartbeat: timestamptz
- country_code: text
- region: text
- city: text
- session_started_at: timestamptz
- created_at: timestamptz
- updated_at: timestamptz

## profiles
- id: uuid
- name: text
- email: text
- image: text
- customer_id: text
- price_id: text
- has_access: bool
- created_at: timestamptz
- updated_at: timestamptz