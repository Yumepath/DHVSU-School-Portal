# Modernization checklist

- [x] Audit the original Angular and Ionic application and create `codex/full-stack-modernization`. The original sign-in bypassed credentials, academic records lived in templates, and download actions referenced missing assets.
- [x] Replace static page data and bypassed sign-in with Supabase Auth and PostgreSQL workflows.
- [x] Add migrations, constraints, audit triggers, row-level access, and reproducible fictional seed data.
- [x] Build student, faculty, and administrator workspaces with shared navigation, forms, and records.
- [x] Add password recovery, role guards, trusted administrator provisioning, and activation controls.
- [x] Apply the migrations and deploy the account provisioning function to the connected Supabase project. Populate the project with fictional records and privately credentialed demo accounts.
- [x] Verify direct Data API access, login for all roles, session persistence, catalog and timetable writes, enrollment, grade submission and publication, attendance, announcement publishing, CSV export, and activation controls.
- [x] Verify the responsive layout at 360, 390, 768, 1024, 1366, and 1920 px. Capture screenshots in the browser.
- [x] Prepare the production build, Cloudflare Pages SPA routing, local setup, and ERD.
- [ ] Verify production delivery of password recovery messages with the configured SMTP provider and deployment origin.
- [ ] Publish the application to Cloudflare Pages after approval.
