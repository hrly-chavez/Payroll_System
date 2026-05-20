# PAYROLL SYSTEM DEPLOYMENT CHECKLIST

## SYSTEM INFORMATION

Frontend Domain:
- payroll.attitech.ph

Backend Domain:
- api.payroll.attitech.ph

Frontend Hosting:
- Bluehost

Backend Hosting:
- Railway

Database:
- Railway MySQL

==================================================
PRE-DEPLOYMENT CHECKLIST
==================================================

[✔] Database backup created
[✔] Database restore tested
[✔] Migration state clean
[✔] No pending migrations
[✔] No hardcoded localhost production URLs remain
[✔] AllowAny endpoints reviewed
[ ] DEBUG=False ready for production
[ ] Environment variables configured
[✔] Payroll calculations verified
[✔] Approval workflow verified
[✔] Attendance integration verified
[✔] Regeneration flow verified
[✔] Role permissions verified
[✔] PDF generation verified
[] Frontend production build tested
[ ] Railway backend tested
[ ] API endpoints verified
[ ] HTTPS/SSL verified
[ ] CORS verified
[ ] CSRF trusted origins verified

==================================================
BACKEND DEPLOYMENT FLOW
==================================================

1. Push latest stable code to GitHub

2. Verify Railway deployment logs

3. Run migrations:
python manage.py migrate

4. Verify backend health:
- authentication
- payroll endpoints
- attendance endpoints

5. Verify Railway environment variables

==================================================
FRONTEND DEPLOYMENT FLOW
==================================================

1. Build frontend:
npm run build

2. Upload build files to Bluehost

3. Verify React routing

4. Verify frontend/backend communication

5. Verify production API URL

==================================================
POST-DEPLOYMENT TESTING
==================================================

[ ] Login works
[ ] JWT refresh works
[ ] Attendance works
[ ] Payroll generation works
[ ] Payroll approval works
[ ] Payroll regeneration works
[ ] Notifications work
[ ] Reports/PDFs work
[ ] Role permissions work
[ ] Mobile responsiveness checked

==================================================
ROLLBACK PROCEDURE
==================================================

If deployment fails:

1. Restore previous frontend build

2. Restore previous backend deployment

3. Restore database backup if necessary

4. Verify application accessibility

5. Verify payroll integrity

==================================================
IMPORTANT PRODUCTION NOTES
==================================================

- Never run makemigrations directly in production deployment
- Always backup database before major deployments
- Verify migrations locally before production
- Never commit .env files
- Verify Railway logs after every deployment
- Test payroll generation after backend updates
- Test authentication after security changes

