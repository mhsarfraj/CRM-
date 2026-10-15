# CRM Pro — HTML/CSS/JS + Google Apps Script + Google Sheets

Migrated from the Flask/MySQL starter. No Python, Node, MySQL or build step is needed.

## Structure
- `index.html`, `css/app.css`, `js/config.js` (API URL), `js/app.js` (UI, router, API service)
- `google-apps-script/Code.gs` (backend: auth, validation, CRUD, dashboard, audit)
- `DEPLOYMENT.md`, `SECURITY.md`

## What was kept / changed from the original project
| Original (Flask/MySQL) | Now |
|---|---|
| users (hash, role admin/sales/manager) | `Users` sheet, salted iterated SHA-256, roles admin/sales |
| leads, customers, deals, tasks, activities | Sheets with UUID ids, archive flag, timestamps; full create/edit/archive/restore |
| audit_logs | `AuditLogs` sheet, written on every login/create/update/archive/move |
| dashboard (counts, pipeline, lead statuses) | `dashboard` action: KPIs, weighted pipeline, win/conversion rate, charts |
| pipeline.html | Deals board with stage moves (select, persisted; no duplicates) |
| contacts.html, reports.html, `*_backup` folders, `.venv` | Not migrated (see "Not included") |

## API contract (POST, body is JSON sent as text/plain)
Request `{action, token, ...}` → `{ok:true, data}` or `{ok:false, code, error}`.
Public: `health`, `login{email,password}`. Authenticated: `logout`, `lookups`, `list{entity,archived?}`, `save{entity,record,force?}`,
`archive{entity,id,restore?}`, `moveDeal{id,stage,loss_reason?}`, `convertLead{id}`, `dashboard`.
Admin only: `userList`, `userSave{record}`, `auditList`. Entities: leads, customers, deals, tasks, activities.
Error codes: AUTH, AUTH_FAILED, LOCKED, FORBIDDEN, VALIDATION, DUPLICATE, NOT_FOUND, SETUP, BAD_REQUEST, SERVER.

## Dashboard calculations
Pipeline value = sum(value) of deals not Won/Lost. Weighted = sum(value × probability/100) over the same deals.
Lead conversion % = Converted leads ÷ all active leads. Win rate % = Won ÷ (Won + Lost). Shown as "—" when the denominator is 0.
Overdue = open tasks with due date before today. Monthly revenue = Won deals grouped by expected-close month.

## Not included (be aware)
Contacts module, a dedicated Reports page (date-range filters, printable layouts, per-salesperson reports), notes/documents (Drive),
notifications, password-reset email, CSV import, bulk actions, drag-and-drop (use the stage select), Lucide icons (unicode glyphs used),
configurable pipeline stages and sample-data generator. Stages are constants in `Code.gs` (`STAGES`).

## Multi-business (SaaS) mode — v2
- **Platform owner** (`super`, created by `setup()`) logs in and sees only the **Businesses** tab: create a customer business, pick its industry, plan (Trial/Starter/Pro/Business), status and subscription end date, and set the business admin's login.
- **Each business** is a separate workspace. Every row carries a `ws` id; the server filters every read and blocks every cross-business edit.
- **On login the CRM customises itself**: business name and logo letter, brand colour, currency, tab names (e.g. Enquiries / Clients / Property Deals), pipeline stages and lead sources from the industry preset.
- **Industry presets**: General, Real Estate, Agency/Services, Retail/E-commerce, Clinic/Healthcare, Education/Coaching (edit `TPL` in `Code.gs` to add more).
- **Subscriptions**: Suspended or expired workspaces are blocked at login and on the next request of an open session. Renewal = change the end date in Businesses. Payment collection is NOT built in; you update plan/date manually or integrate a payment link/webhook later.
- **Sample data**: business admin → Settings → Load sample data (20 leads, 8 customers, 12 deals, 10 tasks, 8 activities, tagged "Sample data"; only into an empty workspace).
- Roles: `super` (you), `admin` (business owner: settings, users, audit), `sales`.
- Redeploy note: this version adds a `ws` column. Use a NEW spreadsheet (or delete the old tabs) before running `setup()`.
- Tested logic only, not a live deployment. One Google Sheet holds all businesses; for strict data separation or large scale, use a separate sheet per business.

## Roles and personal workspaces — v3
| Role | Sees | Can do |
|---|---|---|
| **Admin** (business owner) | everything in the business | all records, assign/reassign, users, settings, audit log, sample data, team performance |
| **Manager** | everything in the business | all records, reassign, team performance; no users/settings/audit |
| **Employee** | only records they own (leads, customers, deals, tasks, activities) | create/edit/archive own records, convert own leads; cannot reassign, see colleagues' data, or open admin tabs |
Every employee opens to "My workspace": dashboard, KPIs and charts are calculated from their own records only. All of this is enforced in `Code.gs` (not just hidden in the UI).
Everyone gets **My profile** with password change. Admin/Manager get **Team** (per-employee leads, conversions, open deals, won revenue, tasks, overdue).
Sample data is spread across the business's employees so you can demo the separation.
