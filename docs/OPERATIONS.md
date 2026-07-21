# Governed Revenue Recognition Operations

The supported backend surface is `/api/governed-revenue`. Legacy generated AI and gap routes remain in the repository for comparison, but `backend/server.js` does not mount them.

## Controlled setup

1. Copy `.env.example` to a secret-managed runtime environment and replace every placeholder.
2. Run `./scripts/bootstrap.sh` explicitly to install lockfile-pinned dependencies.
3. Point `DATABASE_URL` at the intended database and run `./scripts/migrate.sh apply-governed-revrec-004` through the normal change-approval process.
4. Provision users, tenants, and memberships through an administrator-controlled process. Public registration is disabled.
5. Enable a provider only after its HTTPS endpoint and runtime-injected credential are present. Readiness fails closed until CRM, contracts, billing, ERP, usage, general-ledger, and FX providers are configured.
6. Run `./start.sh`. It refuses occupied ports and missing dependencies and changes neither database nor dependency state.

## Accounting workflow

Contract versions and amendments are immutable inputs. Satisfaction events create deterministic schedules; journals carry rule, allocation, schedule, source, and optional FX evidence. A preparer submits a proposal, a different controller approves it, an authorized posting operator records authoritative provider outcomes, and an accountant or auditor reconciles the posted journal. Journals are individually locked before an auditor locks a period. Locked evidence can be corrected only through linked reversal, restatement, or credit records in an open period.

Late events are replayed against locked history and stored with a digest. Audit exports are append-only manifests. Provider failures are sanitized, retry-bounded, and retained as evidence; no provider response can silently advance a journal.

## Validation boundary

`npm test` proves deterministic calculation, workflow authorization, evidence-model, migration, and launcher contracts without external services. Before production use, an independent ASC 606/IFRS 15 accounting owner must approve policy/rule versions and golden schedules. Database migration rehearsal, provider contract tests, restore tests, security review, access recertification, and end-to-end posting/reconciliation tests remain required in a controlled environment.

Development fixtures require an explicit disposable-database acknowledgement. They are blocked when `NODE_ENV=production`.
