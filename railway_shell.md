# Railway Shell Access Guide (Windows)

## Purpose

This guide explains how to access your Railway deployment shell using the Railway CLI.

This is useful for:

* Creating Django superusers
* Running management commands
* Debugging production deployments
* Checking logs/files inside Railway containers

---

# STEP 1 — Install Node.js

Railway CLI requires Node.js.

Download Node.js:

https://nodejs.org/

Recommended:

* Download the LTS version

After installation, verify:

```bash
node -v
npm -v
```

If versions appear, Node.js is installed correctly.

---

# STEP 2 — Install Railway CLI

Open:

* Command Prompt
* PowerShell
* Windows Terminal

Run:

```bash
npm install -g @railway/cli
```

Wait for installation to complete.

---

# STEP 3 — Verify Railway CLI Installation

Run:

```bash
railway --version
```

If version appears, Railway CLI is installed correctly.

---

# STEP 4 — Login To Railway

Run:

```bash
railway login
```

Your browser will open.

Login using your Railway account.

After successful login, terminal should authenticate automatically.

---


# STEP 5 — Open Your Backend Project Folder

Navigate to your backend folder.

Example:

```bash
cd Desktop
cd Payroll_System
cd backend
```

VERY IMPORTANT:

You must run Railway commands inside the backend project directory.

The folder should contain:

```txt
manage.py
requirements.txt
core_folder/
```

---

# STEP 6 — Link Local Project To Railway

Run:

```bash
railway link
```

Railway will ask you to select:

1. Workspace
2. Project
3. Environment
4. Service

Select your backend service:

```txt
responsible-vitality
```

After linking, Railway creates:

```txt
.railway/
```

inside your backend folder.

---

# STEP 7 — Open Railway Shell

Run:

```bash
railway ssh
```

If successful, you will enter the Railway container shell.

Example:

```bash
/app $
```

You are now inside the live Railway deployment container.

---

# STEP 8 — Create Django Superuser

Inside Railway shell, run:

```bash
python manage.py createsuperuser
```

Example:

```txt
Username: admin
Email address: admin@example.com
Password:
Password (again):
```

After success:

```txt
Superuser created successfully.
```

---

# STEP 9 — Login To Django Admin

Open:

```txt
https://api.payroll.attitech.ph/administrator/
```

or temporary Railway domain:

```txt
https://responsible-vitality-production-a37e.up.railway.app/administrator/
```

Login using the superuser credentials you created.

---

# Useful Railway Shell Commands

## Open shell

```bash
railway ssh
```

## View linked project

```bash
railway status
```

## View variables

```bash
railway variables
```

## Redeploy service

```bash
railway up
```

## Logout

```bash
railway logout
```

---

# IMPORTANT DEPLOYMENT RULES

NEVER run:

```bash
python manage.py makemigrations
```

inside production Railway.

ONLY run:

```bash
python manage.py migrate
```

when applying existing migrations.

---

# Recommended Production Workflow

For backend updates:

1. Update backend locally
2. Test locally
3. Commit changes
4. Push to GitHub
5. Railway auto-deploys
6. Run migrate if needed
7. Verify deployment logs

---

# Troubleshooting

## railway command not found

Cause:

* Node.js not installed
* Railway CLI not installed correctly

Fix:

```bash
npm install -g @railway/cli
```

---

## railway ssh fails

Possible causes:

* Not logged in
* Project not linked
* Wrong folder
* Service not selected

Fix:

```bash
railway login
railway link
railway ssh
```

---

## Cannot create superuser

Check:

* migrations applied
* database connected properly

Run:

```bash
python manage.py migrate
```

before:

```bash
python manage.py createsuperuser
```

---

# Current Deployment Architecture

Frontend:

* Hostinger

Backend:

* Railway

Database:

* Railway MySQL

Backend Domain:

* api.payroll.attitech.ph

Frontend Domain:

* payroll.attitech.ph
