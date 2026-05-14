# DATABASE BACKUP PROCEDURES

==================================================
MANUAL MYSQL BACKUP
==================================================

mysqldump -u team_user -p payroll_db > payroll_backup.sql

==================================================
RESTORE MYSQL BACKUP
==================================================

mysql -u team_user -p payroll_db < payroll_backup.sql


==================================================
MIGRATION SAFETY RULES
==================================================

- Never run makemigrations directly in production
- Always create migrations locally first
- Always test migrations locally
- Always backup database before migrations
- Always review migration files before deployment
- Avoid destructive migrations without backup verification
- Verify payroll-related schema changes carefully

==================================================
IMPORTANT NOTES
==================================================

- Always backup before migrations
- Always backup before deployment
- Verify backup restoration periodically
- Never test migrations without backup
- Store production backups securely


