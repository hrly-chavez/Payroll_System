# Payroll_System
Interactive Payroll System of AttiTech

# TODO: PLEASE KUNG NAA MOY I ADD NA LIBRARY I UPDATE ANG REQUIREMENTS


What to do after cloning

1. make venv(sample root folder)
 >backend
 >frontend
 >venv

2. pip install requirements.txt 
3. cd frontend
4. npm install 


#Project Description

Automated Enterprise Payroll & Workforce Management System

The system is a sophisticated web-based platform engineered to bridge the gap between raw workforce data and automated financial disbursement. At its core, the architecture features a high-precision relational schema designed in MySQL that ensures strict data integrity across employee profiles, granular attendance logs, and complex financial transactions. The database is structured to support "point-in-time" reporting, allowing the system to preserve the historical accuracy of payslips even as tax brackets, holiday policies, or individual salary rates evolve over time.

The backend, powered by Django REST Framework, features a modular payroll engine that reconciles diverse business rules into a unified computation workflow. This logic automatically transforms raw clock-in/out timestamps into "payable hours" while simultaneously calculating overtime premiums, holiday pay, and statutory deductions. By implementing a hierarchical policy engine, the system can handle overlapping rules—such as special holiday rates stacked with rest day premiums—without manual intervention. Furthermore, the inclusion of a per-employee payroll regeneration feature allows administrators to validate or audit individual records in isolation, ensuring that corrections can be made without disrupting the global processing batch.

The user interface was developed using React.js and Ant Design to deliver a high-density, professional dashboard capable of managing large-scale datasets. This frontend facilitates a secure, multi-stage workflow—moving from attendance recording to payroll approval and final disbursement—with a comprehensive audit trail for every action. By integrating a robust Django-based logic layer with a responsive modern interface, the platform eliminates the risks associated with manual processing, significantly accelerating the payroll cycle while maintaining 100% computational accuracy across the organization.
