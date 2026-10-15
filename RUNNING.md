# How to run CRM Pro and how a new business signs in

## A. One-time setup (about 10 minutes)
1. Create a Google Sheet. **Extensions → Apps Script**. Paste all of `google-apps-script/Code.gs`. Save.
2. **Project Settings → Script properties**: add `ADMIN_EMAIL` (your email) and `ADMIN_PASSWORD` (10+ characters). This becomes the **Platform Owner** login.
3. Choose function **setup** → Run → authorize. Then choose **demoSetup** → Run. (Creates 3 demo businesses with employees and sample data.)
4. **Deploy → New deployment → Web app**: Execute as *Me*, access *Anyone*. Copy the `/exec` URL.
5. Put the URL in `js/config.js` (`API_URL`).
6. Open `index.html` by double-clicking it (or host the folder on GitHub Pages / Netlify). If a browser blocks the file:// page, use VS Code "Live Server" or GitHub Pages.

## B. The three pages
| Page | Who | Sees |
|---|---|---|
| `owner.html` | You (platform owner) | Only the **Businesses** tab: create businesses, set industry/plan/expiry, suspend or renew |
| `admin.html` | Business owner / manager | Dashboard, all records, Team, Users, Settings, Audit log |
| `employee.html` | Employees | "My workspace": only their own leads, customers, deals, tasks |
A person signing in on the wrong page is refused and told which page to use.

## C. Onboarding a new business (your sales flow)
1. Sign in at `owner.html` → **Businesses → New business**: name, industry, plan, subscription end date, admin name/email/password.
2. Send the customer: the `admin.html` link, their email and the temporary password (they change it in **My profile**).
3. The business admin signs in → CRM already shows their industry labels, stages and colours → **Settings** to set name/colour/currency, optionally **Load sample data** → **Users** to add employees (Employee / Manager / Admin).
4. Employees sign in at `employee.html` with the email/password the admin set.
5. Renewal: Businesses → Edit → change the end date. Suspending blocks all that business's users immediately.

## D. Demo logins (from demoSetup) — password for all: `Demo@12345678`
| Business | Admin (admin.html) | Employees (employee.html) |
|---|---|---|
| Skyline Realty (real estate) | skyline.admin@demo.com | skyline.riya@demo.com, skyline.amit@demo.com |
| CarePlus Clinic (healthcare) | careplus.admin@demo.com | careplus.riya@demo.com, careplus.amit@demo.com |
| Urban Mart (retail) | urbanmart.admin@demo.com | urbanmart.riya@demo.com, urbanmart.amit@demo.com |
Platform owner: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set. Each demo business has 20 leads, 8 customers, 12 deals, 10 tasks, 8 activities, split between the employees. **Suspend or delete the demo businesses before real customers use the system; the demo password is public.**
