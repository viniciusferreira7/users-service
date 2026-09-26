# users-service

Users microservice for the Marketplace microservices architecture. Owns the
user accounts — sellers and buyers — backed by PostgreSQL 15 via TypeORM.

It owns the `User` entity, the database connection, health probes and API
docs, and registers accounts and logs them in through `POST /auth/register`
and `POST /auth/login`. Every other route requires
`Authorization: Bearer <token>` with a token from `POST /auth/login`; a route
opts out with `@Public()` (auth, `GET /health`, health probes and `GET /`
do).

Protected user reads:

| Route | Returns |
| --- | --- |
| `GET /users/profile` | The logged-in account, read fresh from the database by the token's id |
| `GET /users/sellers` | Active sellers, sorted by name |
| `GET /users/:id` | One user by UUID; `404` if none, `400` if the id is not a UUID |

No response carries the password hash. Only `/users/profile` includes the
email; the other two return the public shape (`id`, names, `role`, `status`)
so any logged-in user cannot harvest other users' emails.

`GET /health` answers `{ "status": "ok", "service": "users-service" }` without
authentication; the api-gateway uses it for its aggregated health check.

`GET /auth/validate-token` (bearer token required) answers `{ userId, email,
role }` for a token whose account still exists and is active, and `401`
otherwise. The api-gateway calls it to authenticate every protected request.

## Where it sits

```
                      ┌──▶ users-service (3334)      ── users_db (5435)
api-gateway (3333) ───┤
                      └──▶ checkout-service (3334) ──[payments exchange]──▶ payments-service (3335)
```

## Data model

`users` table:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid | generated |
| `email` | varchar(255) | unique |
| `password` | varchar(255) | password **hash**; never selected by default |
| `firstName` / `lastName` | varchar(100) | `first_name` / `last_name` columns |
| `role` | enum | `seller` \| `buyer` |
| `status` | enum | `active` \| `inactive`, defaults to `active` |
| `createdAt` / `updatedAt` | timestamptz | set automatically |

## Requirements

- Node 24+
- pnpm 11+
- Docker (PostgreSQL)

## Setup

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm start:dev
```

The service listens on `http://localhost:3334`; Swagger UI is at
`http://localhost:3334/api`. In `dev` TypeORM synchronizes the schema, so
the `users` table is created on first boot.

The test lanes get their own throwaway Postgres behind the `test` profile, on
port 5436 with the `users_db_test` database, so the suite never writes to the
dev database. `pnpm test:int` and `pnpm test:e2e` bring it up themselves
through `pnpm test:infra` (`docker compose --profile test up -d --wait`);
`pnpm test:infra:down` stops it again.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm start:dev` | Watch mode with the observability preload |
| `pnpm build` | Compile to `dist/` |
| `pnpm check` / `pnpm check:fix` | Biome lint + format |
| `pnpm check:type` | `tsc --noEmit` |
| `pnpm test:infra` | Boots the test Postgres and waits for it to be healthy |
| `pnpm test:infra:down` | Stops the test infrastructure |
| `pnpm test:unit` | Unit lane — `*.spec.ts`, no infra |
| `pnpm test:int` | Integration lane — `*.int-spec.ts`, real test Postgres |
| `pnpm test:e2e` | E2E lane — `*.e2e-spec.ts`, full HTTP boot against the test Postgres |
| `pnpm test:cov` | Unit lane with coverage |

## Layout

```
src/
  app.module.ts            Root module: config + env + observability + TypeORM + users + auth + health
  app.setup.ts             CORS + global ValidationPipe, shared by main.ts and the e2e harness
  auth/                    POST /auth/register and /auth/login, JWT strategy, global guard, @Public, rate limits
  config/                  TypeORM options and Swagger document
  env/                     Zod schema, EnvModule and typed EnvService
  health/                  Liveness/readiness/startup probes and graceful shutdown
  users/                   User entity, role/status enums, GET /users routes and UsersModule
  utils/                   Service metadata
test/
  setup-env.ts             Env defaults for the int/e2e lanes
  factories/               DI container, HTTP app, request bodies, test-only routes and tokens
  config/                  OpenAPI document helpers
  utils/                   Test-database guard
```

## Environment

Every variable is validated by `src/env/env.ts` at boot — an invalid or missing
value fails the process instead of surfacing later. See `.env.example` for the
full list.

`JWT_SECRET` signs the tokens `POST /auth/login` issues. It must be the same
value configured in the api-gateway, which verifies them, and at least 32
characters long.
