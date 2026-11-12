#!/usr/bin/env bash
# Writes .env.local for CI from the running local Supabase (npx supabase start). Test-only values; no secrets.
set -euo pipefail
eval "$(npx supabase status -o env | sed 's/^/export SB_/')"
cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${SB_API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SB_ANON_KEY}
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=${SB_SERVICE_ROLE_KEY}
SUPABASE_DB_URL=${SB_DB_URL}
REDIS_URL=redis://localhost:6379
AI_PROVIDER=mock
RATE_LIMIT_DISABLED=1
ENV
echo "wrote .env.local for ${SB_API_URL}"
