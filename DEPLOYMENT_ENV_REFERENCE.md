# DEPLOYMENT ENVIRONMENT VARIABLES

==================================================
BACKEND — LOCAL DEVELOPMENT
==================================================

DEBUG=True

ALLOWED_HOSTS=localhost,127.0.0.1

FRONTEND_URL=http://localhost:3000

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

==================================================
BACKEND — PRODUCTION (RAILWAY)
==================================================

DEBUG=False

ALLOWED_HOSTS=api.payroll.attitech.ph

FRONTEND_URL=https://payroll.attitech.ph

CORS_ALLOWED_ORIGINS=https://payroll.attitech.ph

CSRF_TRUSTED_ORIGINS=https://payroll.attitech.ph

==================================================
FRONTEND — DEVELOPMENT
==================================================

REACT_APP_API_BASE_URL=http://localhost:8000/api

==================================================
FRONTEND — PRODUCTION
==================================================

REACT_APP_API_BASE_URL=https://api.payroll.attitech.ph/api

==================================================
PRODUCTION COOKIE SETTINGS
==================================================

Production deployment requires:

secure=True
samesite="None"

for:
- access_token cookie
- refresh_token cookie

Reason:
Frontend and backend use separate HTTPS subdomains:
- payroll.attitech.ph
- api.payroll.attitech.ph

==================================================
RAILWAY ENVIRONMENT VARIABLES
==================================================

SECRET_KEY=
DEBUG=False

DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=

ALLOWED_HOSTS=api.payroll.attitech.ph

FRONTEND_URL=https://payroll.attitech.ph

CORS_ALLOWED_ORIGINS=https://payroll.attitech.ph

CSRF_TRUSTED_ORIGINS=https://payroll.attitech.ph

EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_USE_TLS=True
EMAIL_PORT=587

==================================================
RAILWAY MYSQL VARIABLES
==================================================

DB_NAME=
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=

These values will come from Railway MySQL service.