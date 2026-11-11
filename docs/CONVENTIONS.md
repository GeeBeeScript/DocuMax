# Conventions

## Componentization

Componentization is a top priority. The goal: any screen is a short composition of named components, and a visual
pattern exists in exactly one place.

### Layers (import direction ↓ only)

```
app/ (routes)          → may import everything below
features/<domain>/     → components/*, lib/*, content/*   (never another feature)
components/marketing   → components/brand, motion, ui, lib/utils
components/app         → components/brand, motion, ui, lib/*
components/brand       → components/ui, lib/utils, content/site
components/motion      → motion/react only
components/ui          → shadcn generated (no business logic)
lib/                   → nothing UI
```

### Rules

1. **Thin routes.** `page.tsx` / `layout.tsx` fetch data and compose components. No styling beyond layout wrappers.
2. **Rule of two.** A markup/styling pattern that appears twice becomes a component (or a `cva` variant).
3. **Content is data.** Marketing copy, nav, pricing, FAQs, feature lists live in typed objects in `content/`. Persona
   variants (property vs contractor) reuse the same components with different content objects.
4. **Entity wording** always comes from `entityLabels(kind)` (`lib/entities/labels.ts`) — never hard-code
   "Property"/"Job".
5. **Variants via `cva`**, exported as `<name>Variants` when other components need them.
6. **Small, typed props.** Prefer composition (`children`, slots) over boolean prop explosions. Extend the native
   element props (`ComponentProps<"div">`) and forward `className` via `cn()`.
7. **Server Components by default.** Add `"use client"` only to the interactive leaf. Pass server data down as props.
8. **One component per file**, kebab-case filename, PascalCase export, named exports only (no default exports
   except Next.js route files). Barrel `index.ts` per component folder.
9. **Feature modules** (`features/<domain>/`): `components/`, `actions.ts` (Server Actions), `queries.ts` (server
   reads), `schema.ts` (zod), `*.test.ts`. Domains: `auth`, `org`, `entities`, `documents`, `review`, `reports`,
   `exports`, `billing`.
10. **Tests:** every brand/marketing/app component gets a render test; generic interactive components (DataTable,
    FileDropzone, UploadTray) get behavior tests.

## TypeScript

- `strict` on. No `any` (use `unknown` + zod). No non-null `!` except in tests.
- Types from zod schemas: `type X = z.infer<typeof XSchema>`. DB types generated with
  `npx supabase gen types typescript --local > lib/supabase/database.types.ts` (Phase 2+).
- Imports via `@/` alias. `cn` from `@/lib/utils`.

## Data access

- **Reads** in Server Components via `features/<domain>/queries.ts` using the RLS-bound server client.
- **Mutations** via Server Actions in `features/<domain>/actions.ts`:
  1. parse input with zod, 2. get user + active org, 3. check role (`assertRole`), 4. perform the write (RLS also
     enforces), 5. `revalidatePath`/`revalidateTag`, 6. return a typed `ActionResult<T>`
     (`{ ok: true, data } | { ok: false, error, fieldErrors? }`).
- **Route Handlers** only for: webhooks (Stripe), file downloads/streams, upload confirmation callbacks, health.
- Never call the service-role client from actions that run on behalf of a user.

## Forms

`react-hook-form` + `@hookform/resolvers/zod`, same schema used by the Server Action. Inline field errors; toast
(`sonner`) for action-level results.

## Errors & logging

- Expected failures → `ActionResult` errors with user-safe messages. Unexpected → throw; caught by `error.tsx`.
- Worker: structured logs via `worker/logger.ts`; include `orgId`, `jobId`, `documentId`; never log document text
  or PII.

## Naming

- DB: snake_case tables (plural) and columns; money columns end with `_cents`.
- TS: camelCase vars, PascalCase types/components, SCREAMING_SNAKE for constants.
- Queue names kebab-case (`process-document`).

## Git

- Branch per phase/feature: `phase-03-uploads`, `feat/review-shortcuts`, `fix/…`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.
- Each phase ends with `npm run check` green and its phase doc's DoD checklist ticked.
- Migrations are append-only (`supabase/migrations/<timestamp>_<name>.sql`); never edit a shipped migration.

## Formatting

Prettier (`printWidth` 110, Tailwind class sorting plugin). ESLint `next/core-web-vitals` + `next/typescript`.
