from rest_framework import viewsets, status, generics, permissions
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.permissions import IsRole;
import random, string, json
from rest_framework.views import APIView
from django.db import transaction
from django.db.models import Q
from django.utils.timezone import now
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password
from datetime import timedelta
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_decode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from io import BytesIO
from django.http import FileResponse
from accounts.tokens import short_lived_token_generator
from django.shortcuts import redirect
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

import logging
import secrets
from .serializers import CompanyNoteSerializer
from rest_framework import generics


#--------------------------Address
# List all provinces
class ProvinceListAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer

# List cities for a province
class CityListByProvinceAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CitySerializer

    def get_queryset(self):
        province_id = self.kwargs.get("province_id")
        return City.objects.filter(province_id=province_id)

# List barangays for a city
class BarangayListByCityAPIView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = BarangaySerializer

    def get_queryset(self):
        city_id = self.kwargs.get("city_id")
        return Barangay.objects.filter(city_id=city_id)

#--------------------------Department
#done logs
class DepartmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Department.objects.all().order_by("-created_at")
    serializer_class = DepartmentSerializer
    public_actions = ['list', 'retrieve']

    # ---------------- CREATE ----------------
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        holiday_bases = request.data.get("holiday_base", [])

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Properly create instance using serializer
        department = serializer.save()

        # Attach user for signals
        department._current_user = request.user
        department.save()

        if not holiday_bases:
            raise ValidationError({"holiday_base": "At least one holiday base is required."})

        for base in holiday_bases:
            DepartmentHolidayCalendar.objects.create(
                department=department,
                base=base,
            )

        # Re-serialize properly using instance
        return Response(
            self.get_serializer(department).data,
            status=status.HTTP_201_CREATED
        )

    # ---------------- UPDATE ----------------
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        holiday_bases = request.data.get("holiday_base", [])

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        instance._current_user = request.user
        self.perform_update(serializer)

        if holiday_bases:
            # Delete old bases
            DepartmentHolidayCalendar.objects.filter(
                department=instance
            ).delete()

            # Create new ones
            for base in holiday_bases:
                DepartmentHolidayCalendar.objects.create(
                    department=instance,
                    base=base,
                )

        return Response(serializer.data)

# para ni sa populate ang shifts sa drop down
class ShiftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsRole]
    queryset = Shift.objects.filter(is_active=True)
    serializer_class = ShiftSerializer
    public_actions = ['list', 'retrieve']
    
#user account
#done logs
logger = logging.getLogger(__name__)  # Use Django logging

class UserViewSet(viewsets.ModelViewSet):
    """
    User CRUD + custom actions like get_by_employee and reset password
    """
    queryset = User.objects.all()
    serializer_class = UserAccountSerializer
    allowed_roles = ["ADMIN"]
    display_time = serializers.SerializerMethodField()

    @action(detail=False, methods=["get"], url_path="employee/(?P<employee_id>[^/.]+)")
    def get_by_employee(self, request, employee_id=None):
        """Retrieve user account linked to a specific employee"""
        from shared_model.models import Employee  # adjust import if needed

        try:
            employee = Employee.objects.get(id=employee_id)
        except Employee.DoesNotExist:
            return Response({"detail": "Employee not found."}, status=status.HTTP_404_NOT_FOUND)

        # Use the related_name "user"
        user = getattr(employee, "user", None)
        if not user:
            return Response({"detail": "User account not found for this employee."}, status=status.HTTP_404_NOT_FOUND)

        serializer = self.get_serializer(user)
        return Response(serializer.data)
    
    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """
        Admin resets a user's password.
        - Generates a strong random password
        - Hashes and saves it
        - Sends it via email to the employee
        """
        user = self.get_object()

        # Get reason from request
        reason = request.data.get("reason")
        if reason:
            user._audit_reason = reason

        # Generate strong random password (12 characters, mix of letters, digits, punctuation)
        new_password = ''.join(
            secrets.choice(string.ascii_letters + string.digits + string.punctuation)
            for _ in range(12)
        )

        # Hash password properly
        user.set_password(new_password)
        user.save()

        AuditLog.objects.create(
            user=request.user,  # the admin who performed the reset
            action="RESET_PASSWORD",
            model_name="User",
            object_id=str(user.pk),
            old_data="",  # could store old password hash if you want
            new_data=f"Password reset by {request.user.user_name}",
            reason=reason,
        )

        logger.info(f"Password for user '{user.user_name}' has been reset by admin '{request.user.user_name}'.")

        # Attempt to send email
        email_sent = False
        try:
            send_mail(
                subject="Your New Account Password",
                message=f"Hello {user.employee.fname} {user.employee.lname},\n\nYour password has been reset by HR.\n\n"
                        f"New password: {new_password}\n\nPlease log in and change it immediately.",
                from_email=None,  # will use DEFAULT_FROM_EMAIL from settings.py
                recipient_list=[user.employee.email],
                fail_silently=False,
            )
            email_sent = True
            logger.info(f"Reset password email sent to '{user.employee.email}'.")
        except Exception as e:
            logger.error(f"Failed to send reset password email to '{user.employee.email}': {str(e)}")

        # Return response
        if email_sent:
            return Response({"detail": "Password reset successfully and emailed to the user."}, status=status.HTTP_200_OK)
        else:
            return Response(
                {"detail": "Password reset successfully, but failed to send email. Check logs for details."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate_user(self, request, pk=None):
        """
        Toggle user active status (deactivate/reactivate).
        """
        user = self.get_object()

        # Attach current user for audit log
        user._current_user = request.user

        # Get reason from request
        reason = request.data.get("reason")
        if reason:
            user._audit_reason = reason  # attach reason to instance

        # Toggle active status
        if user.is_active:
            user.is_active = False
            user.user_status = "INACTIVE"  # update user_status if you added the field
            action_name = "DEACTIVATED"
        else:
            user.is_active = True
            user.user_status = "ACTIVE"
            action_name = "REACTIVATED"

        user.save()  # signals will now pick up _audit_reason

        return Response(
            {"detail": f"User successfully {action_name.lower()}.", "is_active": user.is_active},
            status=status.HTTP_200_OK
        )

#for employee create 
def parse_json_field(value, default):
        if isinstance(value, str):
            return json.loads(value)
        return value if value is not None else default
        
#done logs
#employee details crud
class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Employee.objects.filter(is_active=True)
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    
    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSerializer
    
    def get_permissions(self):
        if self.action == "create_first_superadmin":
            return [AllowAny()]  # bypass auth completely
        return [IsAuthenticated(), IsRole()]

    def get_queryset(self):
        user = self.request.user

        queryset = super().get_queryset()

        # If ADMIN → hide SUPER_ADMIN employees
        if user.role == "ADMIN":
            queryset = queryset.exclude(user__role="SUPER_ADMIN")

        return queryset
    
    # public actions (unauthenticated) only for first superadmin
    public_actions = ['create_first_superadmin']

    @action(detail=False, methods=["get"], url_path=r"by-department/(?P<dept_id>\d+)")
    def by_department(self, request, dept_id=None):
        user = request.user
        employees = self.queryset.filter(department_id=dept_id)

        # If logged-in user is ADMIN, exclude SUPER_ADMIN employees
        if user.role == "ADMIN":
            employees = employees.exclude(user__role="SUPER_ADMIN")

        serializer = self.get_serializer(employees, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=["get"], url_path=r"details")
    def details(self, request, pk=None):
        employee = self.get_object()
        serializer = self.get_serializer(employee)
        return Response(serializer.data)
    
    # -------------------
    # CHECKING EXISTING EMAIL EMPLOYEE
    # ------------------- 
    @action(detail=False, methods=["get"], url_path="check-email")
    def check_email(self, request):
        email = request.query_params.get("email")
        employee_id = request.query_params.get("employee_id")

        if not email:
            return Response({"error": "Email parameter is required."}, status=400)

        queryset = Employee.objects.filter(
            email__iexact=email,
            is_active=True
        )

        # EXCLUDE CURRENT EMPLOYEE (for update)
        if employee_id:
            queryset = queryset.exclude(id=employee_id)

        exists = queryset.exists()

        return Response({"exists": exists})
        
    # -------------------
    # CREATE FIRST SUPER ADMIN EMPLOYEE
    # ------------------- 
    @action(detail=False, methods=["post"], url_path="create-first-superadmin")
    def create_first_superadmin(self, request):
        # Check if SUPER_ADMIN exists
        super_admin_exists = User.objects.filter(role="SUPER_ADMIN", is_superuser=False).exists()
        if super_admin_exists:
            return Response({"error": "SUPER_ADMIN already exists."}, status=403)

        # Create Employee
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = serializer.save()

        # Generate username & password
        username = f"{employee.fname.lower()}{employee.id}"
        password = "".join(random.choices(string.ascii_letters + string.digits, k=8))

        # Create User
        user = User(
            user_name=username,
            role="SUPER_ADMIN",
            employee=employee,
        )
        user.set_password(password)
        user.save()

        # --------------------------
        # SEND EMAIL
        # --------------------------
        try:
            send_mail(
                subject="Payroll System - SUPER ADMIN Account Created",
                message=f"""
                            Hello {employee.fname} {employee.lname},

                            Your SUPER ADMIN account has been successfully created.

                            Login Details:

                            Username: {username}
                            Temporary Password: {password}

                            IMPORTANT:
                            Please login immediately and change your password.

                            Login here:
                            http://localhost:3000/

                            If you did not expect this email, please contact system support.

                            Regards,
                            Payroll System
                            """,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[employee.email],
                fail_silently=False,
            )
        except Exception as e:
            print("Email sending failed:", str(e))

        # --------------------------
        # MANUAL AUDIT LOG
        # --------------------------
        AuditLog.objects.create(
            user=None,  # no signed-in user for first superadmin
            action="CREATE FIRST SUPER ADMIN ACCOUNT",
            model_name="User / Employee",
            object_id=str(employee.id),
            old_data=None,
            new_data={
                "employee": EmployeeSerializer(employee).data,
                "user": {
                    "user_name": username,
                    "role": "SUPER_ADMIN",
                },
            },
            # timestamp auto-added
        )

        return Response({
            "message": "First SUPER_ADMIN created successfully",
            "employee_id": employee.id,
            "username": username,
            "password": password
        }, status=201)

    @action(detail=False, methods=["post"], url_path="create-full-employee")
    @transaction.atomic
    def create_full_employee(self, request):
        """
        Create employee + user + salary + contributions + allowances in one atomic transaction
        """
        data = request.data
        salary = json.loads(request.POST.get("salary", "{}"))
        contributions = json.loads(request.POST.get("contributions", "[]"))
        allowances = json.loads(request.POST.get("allowances", "[]"))
        requested_role = data.get("role", "EMPLOYEE")

        # -----------------------------
        # 1. Role checks
        # -----------------------------
        signed_in_user = request.user
        if signed_in_user.role == "ADMIN" and requested_role != "EMPLOYEE":
            return Response({"error": "ADMINs can only create EMPLOYEE users."}, status=403)
        if signed_in_user.role == "SUPER_ADMIN" and requested_role not in ["ADMIN", "SUPER_ADMIN"]:
            return Response({"error": "SUPER_ADMIN can only create ADMIN or SUPER_ADMIN users."}, status=403)
        if signed_in_user.role not in ["ADMIN", "SUPER_ADMIN"]:
            return Response({"error": "You do not have permission to create users."}, status=403)

        # -----------------------------
        # 2. Create Employee
        # -----------------------------
        employee_serializer = EmployeeCreateSerializer(data=data)
        employee_serializer.is_valid(raise_exception=True)
        employee = employee_serializer.save(_current_user=signed_in_user)

        # -----------------------------
        # 3. Create User (credentials)
        # -----------------------------
        username = f"{employee.fname.lower()}{employee.id}"
        password = "".join(random.choices(string.ascii_letters + string.digits, k=8))

        user = User(
            user_name=username,
            role=requested_role,
            employee=employee
        )
        user.set_password(password)
        user._current_user = signed_in_user
        user.save()

        # -----------------------------
        # 3.5 Send Credentials Email
        # -----------------------------
        try:
            subject = "Your Payroll System Account Credentials"

            context = {
                "full_name": f"{employee.fname} {employee.lname}",
                "username": username,
                "password": password,
            }

            text_content = f"""
        Hello {context['full_name']},

        Your Payroll System account has been created.

        Username: {username}
        Password: {password}

        Please log in and change your password immediately.

        Regards,
        Payroll System Admin
        """

            html_content = f"""
            <p>Hello <strong>{context['full_name']}</strong>,</p>

            <p>Your <strong>Payroll System</strong> account has been created.</p>

            <p>
                <strong>Username:</strong> {username}<br>
                <strong>Password:</strong> {password}
            </p>

            <p>Please log in and change your password immediately.</p>

            <br>
            <p>Regards,<br>Payroll System Admin</p>
            """

            email = EmailMultiAlternatives(
                subject,
                text_content,
                settings.DEFAULT_FROM_EMAIL,
                [employee.email],  # send to employee email
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)

        except Exception as e:
            print("Email sending failed:", str(e))

        # -----------------------------
        # 4. Create Salary
        # -----------------------------
        salary_data = request.data.get("salary")
        contributions_data = request.data.get("contributions")
        allowances_data = request.data.get("allowances")

        # Parse JSON if they come as strings
        if isinstance(salary_data, str):
            salary_data = json.loads(salary_data)

        if isinstance(contributions_data, str):
            contributions_data = json.loads(contributions_data)

        if isinstance(allowances_data, str):
            allowances_data = json.loads(allowances_data)
            
            # Add required fields
            salary_data["employee"] = employee.id
            salary_data.setdefault("status", "Active")  # ensure salary is active
            
            # Serialize and save
            salary_serializer = EmployeeSalarySerializer(
                data=salary_data, context={"_current_user": signed_in_user}
            )
            salary_serializer.is_valid(raise_exception=True)
            salary_obj = salary_serializer.save()

        # -----------------------------
        # 5. Create Contributions
        # -----------------------------
        for c in contributions_data or []:
            if not isinstance(c, dict):
                continue  # or raise error

            c["employee"] = employee.id
            serializer = EmployeeDeductionCreateSerializer(data=c)
            serializer.is_valid(raise_exception=True)
            serializer.save(_current_user=signed_in_user)

        # -----------------------------
        # 6. Create Allowances
        # -----------------------------
        print("ALLOWANCES RECEIVED:", allowances_data)

        for a in allowances_data or []:
            if not isinstance(a, dict):
                continue  # or raise error

            a["employee"] = employee.id
            serializer = EmployeeAllowanceCreateSerializer(data=a)
            serializer.is_valid(raise_exception=True)
            serializer.save(_current_user=signed_in_user)
            
        return Response({
            "message": "Employee created successfully",
            "employee_id": employee.id,
            "username": username,
            "password": password
        }, status=201)
    
    # -------------------
    # UPDATE EMPLOYEE
    # -------------------
    @action(detail=True, methods=["put", "patch"], url_path="update")
    def update_employee(self, request, pk=None):
        employee = self.get_object()
        serializer = EmployeeUpdateSerializer(employee, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Pass _current_user to serializer
        updated_employee = serializer.save(_current_user=request.user)

        return Response({
            "message": "Employee updated successfully",
            "employee": EmployeeSerializer(updated_employee).data
        })

    @action(detail=True, methods=["post"], url_path="update-employment-status")
    def update_employment_status(self, request, pk=None):
        employee = self.get_object()

        new_status = request.data.get("employment_status")
        reason = request.data.get("reason")

        if not new_status:
            return Response(
                {"detail": "Employment status is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save old value for audit
        old_status = employee.employment_status

        # Update
        employee.employment_status = new_status
        employee.save()

        # Optional Audit Log
        AuditLog.objects.create(
            user=request.user,
            action="UPDATE_EMPLOYMENT_STATUS",
            model_name="Employee",
            object_id=str(employee.pk),
            old_data=old_status,
            new_data=new_status,
            reason=reason,
        )

        return Response(
            {
                "detail": "Employment status updated successfully.",
                "employment_status": employee.employment_status
            },
            status=status.HTTP_200_OK
        )
#forgot pass
#undone logs
User = get_user_model()

class ForgotPasswordView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get("username")

        if not username:
            return Response({"detail": "Username is required."}, status=400)

        try:
            user = User.objects.select_related("employee").get(user_name=username)
        except User.DoesNotExist:
            # <-- now return a real 400 for invalid username
            return Response({"detail": "Username does not exist."}, status=400)

        if not user.employee or not user.employee.email:
            return Response({"detail": "User does not have a valid email."}, status=400)

        email = user.employee.email

        # Cleanup old tokens first
        PasswordResetToken.cleanup_expired()
        # Invalidate old unused tokens
        PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

        token = secrets.token_urlsafe(32)

        reset_token = PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=timezone.now() + timedelta(minutes=5)
        )

        reset_url = f"http://localhost:3000/reset-password/{token}/"

        send_mail(
            subject="Payroll System Password Reset",
            message=f"""
Hello {user.user_name},

Click the link below to reset your password:

{reset_url}

This link expires in 5 minutes.
""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )

        return Response({"detail": "Password reset link sent."}, status=200)
    
User = get_user_model()

class CheckResetTokenView(APIView):
    permission_classes = []

    def get(self, request, token):
        try:
            reset_token = PasswordResetToken.objects.select_related("user").get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response({"detail": "Invalid link"}, status=401)

        if reset_token.is_used or reset_token.is_expired():
            return Response({"detail": "Token expired"}, status=401)

        return Response({"detail": "Token valid"}, status=200)

User = get_user_model()

class ResetPasswordConfirmView(APIView):
    permission_classes = []

    def post(self, request):
        token = request.data.get("token")
        password = request.data.get("password")

        try:
            reset_token = PasswordResetToken.objects.select_related("user").get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response({"detail": "Invalid link"}, status=401)

        if reset_token.is_used or reset_token.is_expired():
            return Response({"detail": "Token expired"}, status=401)

        user = reset_token.user

        try:
            validate_password(password, user=user)
        except ValidationError as e:
            return Response({"detail": e.messages}, status=400)

        user.set_password(password)
        user.save()

        reset_token.is_used = True
        reset_token.save()

        return Response({"detail": "Password reset successful"})

#done logs
#employee salary
# Helper function to compute salary for deduction
def get_salary_for_deduction(pay_type, base_rate):
    """
    Converts the employee's salary to the equivalent monthly amount
    for deduction lookup based on Payroll Setting.
    """
    payroll_setting = Payroll_Setting.objects.first()  # assuming 1 row
    divisor = payroll_setting.daily_rate_divisor if payroll_setting else 22

    if pay_type == "Monthly":
        salary_for_deduction = base_rate
    elif pay_type == "Daily":
        salary_for_deduction = base_rate * divisor
    elif pay_type == "Hourly":
        salary_for_deduction = base_rate * 8 * divisor
    else:
        salary_for_deduction = base_rate

    return salary_for_deduction

class EmployeeSalaryViewSet(viewsets.ModelViewSet):
    queryset = Employee_Salary.objects.all().order_by("-effective_from")
    serializer_class = EmployeeSalarySerializer
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset
    
    def get_serializer(self, *args, **kwargs):
        if "context" not in kwargs:
            kwargs["context"] = {}
        kwargs["context"]["_current_user"] = self.request.user
        return super().get_serializer(*args, **kwargs)

    @action(detail=False, methods=["get"], url_path="latest")
    def latest_salary(self, request):
        employee_id = request.query_params.get("employee")
        if not employee_id:
            return Response(
                {"detail": "employee query param is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            employee_id = int(employee_id)
        except ValueError:
            return Response(
                {"detail": "Invalid employee ID"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get the latest salary regardless of the effective_from filter
        salary = (
            Employee_Salary.objects
            .filter(employee_id=employee_id)
            .order_by("-effective_from")
            .first()
        )

        if not salary:
            return Response(
                {"detail": "No salary found"},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = self.get_serializer(salary)
        return Response(serializer.data)
    
    #  NEW ACTION
    @action(detail=False, methods=["post"], url_path="edit")
    @transaction.atomic
    def edit_salary(self, request):
        """
        Create a NEW salary row for the employee (for audit) and recompute percent deductions
        """
        serializer = self.get_serializer(data=request.data, context={"_current_user": request.user})
        serializer.is_valid(raise_exception=True)


        # Create new salary row with current user
        new_salary = serializer.save()

        # Recompute percent-based deductions linked to this employee and effective_from
        self._recompute_percentage_deductions(
            employee_id=new_salary.employee_id,
            salary_obj=new_salary,
            effective_from=new_salary.effective_from,
            user=request.user
        )

        return Response(self.get_serializer(new_salary).data, status=status.HTTP_201_CREATED)

    def _recompute_percentage_deductions(self, employee_id, salary_obj, effective_from, user):
        from shared_model.models import Employee_Deduction, Deduction_Type
        from decimal import Decimal
        from datetime import timedelta

        # Convert salary to "monthly equivalent" for deduction lookup
        salary_amount = Decimal(str(get_salary_for_deduction(salary_obj.pay_type, salary_obj.base_rate)))

        # Get ALL deduction codes this employee has ever had
        existing_codes = (
            Employee_Deduction.objects
            .filter(employee_id=employee_id)
            .values_list("deduction_type__code", flat=True)
            .distinct()
        )

        for code in existing_codes:

            # Find correct tier for this salary range
            matching_type = Deduction_Type.objects.filter(
                code=code,
                is_active=True,
                salary_range_from__lte=salary_amount,
                salary_range_to__gte=salary_amount
            ).first()

            # Get currently active deduction for this code
            active_deduction = Employee_Deduction.objects.filter(
                employee_id=employee_id,
                deduction_type__code=code,
                status="Active"
            ).first()

            if matching_type:

                # Compute amount
                if matching_type.calculation_type == "Fixed":
                    computed_amount = matching_type.amount
                else:
                    computed_amount = round(
                        salary_amount * (matching_type.amount / Decimal("100")), 2
                    )

                # Case 1: Already active and correct tier
                if active_deduction and active_deduction.deduction_type_id == matching_type.id:
                    active_deduction.amount = computed_amount
                    active_deduction._current_user = user
                    active_deduction.save(update_fields=["amount"])
                    print(f"[DEBUG] Updated {code}")

                else:
                    # Inactivate old active tier
                    if active_deduction:
                        active_deduction.status = "Inactive"
                        active_deduction.effective_to = effective_from - timedelta(days=1)
                        active_deduction._current_user = user
                        active_deduction.save(update_fields=["status", "effective_to"])
                        print(f"[DEBUG] Inactivated old {code}")

                    # Check if matching tier already exists (inactive)
                    existing_tier = Employee_Deduction.objects.filter(
                        employee_id=employee_id,
                        deduction_type=matching_type
                    ).first()

                    if existing_tier:
                        # Reactivate old tier
                        existing_tier.status = "Active"
                        existing_tier.amount = computed_amount
                        existing_tier.effective_from = effective_from
                        existing_tier.effective_to = None
                        existing_tier._current_user = user
                        existing_tier.save()
                        print(f"[DEBUG] Reactivated {code}")

                    else:
                        # Create new tier (same code only)
                        Employee_Deduction.objects.create(
                            employee_id=employee_id,
                            deduction_type=matching_type,
                            amount=computed_amount,
                            frequency="Per Period",
                            status="Active",
                            effective_from=effective_from,
                        )
                        print(f"[DEBUG] Created new tier for {code}")

            else:
                # No valid tier for this salary → inactivate if active
                if active_deduction:
                    active_deduction.status = "Inactive"
                    active_deduction.effective_to = effective_from - timedelta(days=1)
                    active_deduction._current_user = user
                    active_deduction.save(update_fields=["status", "effective_to"])
                    print(f"[DEBUG] Fully inactivated {code}")

class PayrollSettingView(APIView):
    """
    Returns payroll setting like daily_rate_divisor
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payroll_setting = Payroll_Setting.objects.first()
        if not payroll_setting:
            # fallback default
            return Response({"daily_rate_divisor": 22, "is_semi_monthly": True})

        return Response({
            "daily_rate_divisor": payroll_setting.daily_rate_divisor,
            "is_semi_monthly": payroll_setting.is_semi_monthly,
        })
    
    
#done logs
#employee deduction
class EmployeeDeductionViewSet(viewsets.ModelViewSet):
    queryset = Employee_Deduction.objects.filter(status="Active")
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(status="Active")
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return EmployeeDeductionListSerializer
        return EmployeeDeductionCreateSerializer
    
    # -----------------
    # CREATE / UPDATE with _current_user
    # -----------------
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(_current_user=request.user)  # <-- pass it here
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save(_current_user=request.user)  # <-- pass it here
        return Response(serializer.data)



    # ----------------- NEW ENDPOINT -----------------
    @action(detail=False, methods=["get"], url_path="deduction-types")
    def deduction_types(self, request):
        salary = request.query_params.get("salary")

        if not salary:
            return Response({"detail": "salary is required"}, status=400)

        try:
            salary = float(salary)
        except ValueError:
            return Response({"detail": "Invalid salary"}, status=400)

        deduction_types = Deduction_Type.objects.filter(
            is_active=True,
            category="TAX",
            salary_range_from__lte=salary,
            salary_range_to__gte=salary
        )

        data = [
            {
                "id": d.id,
                "code": d.code,
                "calculation_type": d.calculation_type,
                "amount": float(d.amount),
            }
            for d in deduction_types
        ]

        return Response(data)

    @action(detail=False, methods=["post"], url_path="replace")
    def replace_deductions(self, request):
        employee_id = request.data.get("employee")
        deductions = request.data.get("deductions", [])

        if not employee_id:
            return Response({"detail": "employee is required"}, status=400)

        if not isinstance(deductions, list) or not deductions:
            return Response({"detail": "deductions list is required"}, status=400)

        with transaction.atomic():
            # 1. Deactivate all active deductions
            Employee_Deduction.objects.filter(
                employee_id=employee_id,
                status="Active"
            ).update(status="Inactive")

            # 2. Create new deductions
            created = []
            for item in deductions:
                serializer = EmployeeDeductionCreateSerializer(
                    data=item
                )
                serializer.is_valid(raise_exception=True)
                obj = serializer.save(_current_user=request.user)
                created.append(serializer.data)

        return Response(
            {"detail": "Deductions replaced successfully", "data": created},
            status=status.HTTP_201_CREATED,
        )
#done logs
#--------------------- ALLOWANCE
class EmployeeAllowanceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Employee_Allowance.objects.all()

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return EmployeeAllowanceSerializer  # read
        return EmployeeAllowanceCreateSerializer  # create/update

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(_current_user=self.request.user)
    
    @action(detail=True, methods=["post"])
    def edit_allowance(self, request, pk=None):
        """
        Custom action to "edit" an allowance:
        - Create a new Employee_Allowance record
        - Keep the old one for history
        """
        original = self.get_object()  # the current allowance
        data = request.data.copy()
        
        # Ensure we use the same employee and allowance_type
        data["employee"] = original.employee.id
        data["allowance_type"] = original.allowance_type.id
        data["status"] = data.get("status", "Active")

        serializer = EmployeeAllowanceCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(_current_user=request.user)


        return Response(
            {"message": "Allowance updated successfully"},
            status=status.HTTP_201_CREATED
        )


class AllowanceTypeListAPIView(APIView):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    """
    GET /employees/allowance-types/ → list all active allowance types
    """
    def get(self, request):
        allowance_types = Allowance_Type.objects.filter(is_active=True)
        serializer = AllowanceTypeSerializer(allowance_types, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
#--------------------- audit logs
#for each employee
@api_view(["GET"])
def employee_audit_logs(request, employee_id):
    """
    Return all audit logs related to a specific employee and related tables.
    Employee logs: all actions
    Related tables: only CREATE logs
    """
    try:
        employee = Employee.objects.get(pk=employee_id)
    except Employee.DoesNotExist:
        return Response({"detail": "Employee not found"}, status=404)

    related_models = ["Employee_Salary", "Employee_Deduction", "Employee_Allowance", "User", "Address"]

    # Employee logs (all actions)
    employee_logs = AuditLog.objects.filter(
        model_name="Employee",
        object_id=str(employee.id)
    )

    # Related logs (ALL actions)
    related_logs = AuditLog.objects.filter(
        model_name__in=related_models
    )


    # Filter related logs for this employee
    filtered_related_logs = []
    for log in related_logs:
        try:
            if log.model_name == "User":
                user_instance = User.objects.get(pk=log.object_id)
                if user_instance.employee and user_instance.employee.id == employee.id:
                    filtered_related_logs.append(log)
            elif log.model_name == "Address":
                address_instance = Address.objects.get(pk=log.object_id)
                if address_instance == employee.address:
                    filtered_related_logs.append(log)
            else:
                model_class = globals()[log.model_name]
                instance = model_class.objects.get(pk=log.object_id)
                if instance.employee.id == employee.id:
                    filtered_related_logs.append(log)
        except Exception:
            continue

    # Combine logs
    all_logs = list(employee_logs) + filtered_related_logs
    all_logs.sort(key=lambda x: x.timestamp, reverse=True)

    serialized_logs = []
    for log in all_logs:
        message_text = ""

        if log.action == "UPDATE_EMPLOYMENT_STATUS":
            message_text = f"Updated employment status"

        elif log.action == "CREATE":
            message_text = f"Created {log.model_name}"

        elif log.action == "UPDATE":
            message_text = f"Updated {log.model_name}"

        elif log.action == "DELETE":
            message_text = f"Deleted {log.model_name}"

        else:
            message_text = log.action

        user_name = log.user.user_name if log.user else ""

        serialized_logs.append({
            "id": log.id,
            "user": user_name,
            "action": message_text,
            "reason": log.reason or "No reason provided",
            "timestamp": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        })


    return Response(serialized_logs)

#audit logs (Reports)
class UserActivityLogViewSet(viewsets.ViewSet):
    """
    Read-only ViewSet that returns all CREATE/UPDATE/DELETE audit logs
    triggered from DRF API requests (not Django admin).
    """
    def list(self, request):
        #delete logs after a day
        one_day_ago = timezone.now() - timedelta(days=1)
        AuditLog.objects.filter(timestamp__lt=one_day_ago).delete()
        
        # Only include logs where user is NOT None and NOT a superuser
        logs = AuditLog.objects.exclude(
            user__isnull=True
        ).order_by("-timestamp")


        serializer = UserActivityAuditLogSerializer(logs, many=True)
        return Response(serializer.data)

#done logs
#COMPANY NOTE
class LatestCompanyNoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        latest_note = Company_Note.objects.order_by("-created_at", "-id").first()
        if latest_note:
            serializer = CompanyNoteSerializer(latest_note)
            return Response(serializer.data)
        return Response(None)

class CompanyNoteCreateView(generics.CreateAPIView):
    queryset = Company_Note.objects.all()
    serializer_class = CompanyNoteSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()

class AttendanceCorrectionLogListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AttendanceCorrectionLogSerializer

    def get_queryset(self):
        qs = Attendance_Correction.objects.select_related("requested_by", "reviewed_by").all()

        search = self.request.query_params.get("search")
        month = self.request.query_params.get("month")  # YYYY-MM
        status_ = self.request.query_params.get("status")

        if status_:
            qs = qs.filter(status=status_)

        if month:
            # month like "2026-02"
            try:
                year, mon = month.split("-")
                qs = qs.filter(requested_at__year=int(year), requested_at__month=int(mon))
            except:
                pass

        if search:
            qs = qs.filter(
                Q(issue_type__icontains=search)
                | Q(status__icontains=search)
                | Q(reason__icontains=search)
                | Q(decline_reason__icontains=search)
                # requested_by is Employee; if it has fields like fname/lname, add them here
            )

        return qs
    
class AttendanceCorrectionLogsPDFView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Export Attendance Correction Logs (PDF)

        Query params:
        - scope=all | user
        - employee_id=<int> (required when scope=user)
        - date=YYYY-MM-DD (optional)
        - month=YYYY-MM (optional)
        - year=YYYY (optional)

        Priority: date > month > year > none (no date filtering)
        """

        scope = (request.query_params.get("scope") or "all").strip().lower()
        employee_id = request.query_params.get("employee_id")

        date_str = request.query_params.get("date")
        month_str = request.query_params.get("month")
        year_str = request.query_params.get("year")

        qs = (
            Attendance_Correction.objects
            .select_related("requested_by", "requested_by__department", "reviewed_by")
            .order_by("-requested_at")
        )

        #  for showing employee name in Scope header
        employee_name = None

        # --- scope filter ---
        if scope == "user":
            if not employee_id:
                return Response(
                    {"detail": "employee_id is required when scope=user."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # filter
            qs = qs.filter(requested_by_id=employee_id)

            #  fetch employee name for header (requested_by is Employee FK)
            try:
                emp_obj = Employee.objects.select_related("department").filter(id=employee_id).first()
                if emp_obj:
                    base_name = f"{getattr(emp_obj, 'fname', '')} {getattr(emp_obj, 'lname', '')}".strip()
                    if getattr(emp_obj, "department", None):
                        employee_name = f"{base_name} ({emp_obj.department.name})" if base_name else emp_obj.department.name
                    else:
                        employee_name = base_name or str(emp_obj)
            except Exception:
                employee_name = None

        # --- date filter (priority: date > month > year) ---
        try:
            if date_str:
                qs = qs.filter(date=date.fromisoformat(date_str))
            elif month_str:
                y, m = month_str.split("-")
                qs = qs.filter(date__year=int(y), date__month=int(m))
            elif year_str:
                qs = qs.filter(date__year=int(year_str))
        except Exception:
            return Response(
                {"detail": "Invalid date/month/year format."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ---- build PDF ----
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(letter),
            leftMargin=0.45 * inch,
            rightMargin=0.45 * inch,
            topMargin=0.45 * inch,
            bottomMargin=0.45 * inch,
            title="Attendance Correction Logs",
        )
        usable_w = doc.width

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "title_style",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            alignment=1,
            spaceAfter=10,
        )

        normal = styles["Normal"]
        normal.fontSize = 9
        normal.leading = 11

        small = ParagraphStyle(
            "small",
            parent=normal,
            fontSize=8.5,
            leading=10.5,
            wordWrap="CJK",
        )

        header_cell = ParagraphStyle(
            "header_cell",
            parent=small,
            fontName="Helvetica-Bold",
            textColor=colors.white,
            alignment=1,
        )

        def _fmt_dt(dt):
            return dt.strftime("%b %d, %Y %I:%M %p") if dt else "-"

        def _fmt_date(d):
            return d.strftime("%Y-%m-%d") if d else "-"

        def _status_color(s: str):
            s = (s or "").lower()
            if s == "verified":
                return colors.HexColor("#16a34a")
            if s == "declined":
                return colors.HexColor("#dc2626")
            return colors.HexColor("#f59e0b")  # pending

        # Header / metadata
        elements = []
        elements.append(Paragraph("ATTENDANCE CORRECTION LOGS", title_style))
        elements.append(Spacer(1, 6))

        #  Scope label now shows employee NAME (and optional dept) when scope=user
        if scope == "all":
            filter_label = "All Users"
        else:
            display = employee_name or f"employee_id={employee_id}"
            filter_label = f"{display}"

        date_filter_label = (
            f"Date: {date_str}" if date_str else
            f"Month: {month_str}" if month_str else
            f"Year: {year_str}" if year_str else
            "No date filter"
        )

        meta_tbl = Table(
            [
                ["Scope:", filter_label, "Filter:", date_filter_label],
                ["Generated At:", _fmt_dt(timezone.now()), "", ""],
            ],
            colWidths=[0.12 * usable_w, 0.38 * usable_w, 0.12 * usable_w, 0.38 * usable_w],
            hAlign="CENTER",
        )
        meta_tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.7, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("SPAN", (2, 1), (3, 1)),
        ]))
        elements.append(meta_tbl)
        elements.append(Spacer(1, 12))

        # Table data
        data = [[
            Paragraph("Requested At", header_cell),
            Paragraph("Attendance Date", header_cell),
            Paragraph("Employee", header_cell),
            Paragraph("Issue Type", header_cell),
            Paragraph("Status", header_cell),
            Paragraph("Reviewed By", header_cell),
            Paragraph("Reviewed At", header_cell),
            Paragraph("Reason", header_cell),
            Paragraph("Decline Reason", header_cell),
        ]]

        for row in qs:
            emp = row.requested_by
            emp_name = f"{getattr(emp, 'fname', '')} {getattr(emp, 'lname', '')}".strip() or str(emp)
            attachment = "Yes" if row.file_attached else "-"

            data.append([
                Paragraph(_fmt_dt(row.requested_at), small),
                Paragraph(_fmt_date(row.date), small),
                Paragraph(emp_name, small),
                Paragraph(row.issue_type or "-", small),
                Paragraph(row.status or "-", small),
                Paragraph(str(row.reviewed_by) if row.reviewed_by else "-", small),
                Paragraph(_fmt_dt(row.reviewed_at), small),
                Paragraph(row.reason or "-", small),
                Paragraph(row.decline_reason or "-", small),
            ])

        # Fit to page width (no clipping)
        col_widths = [
            0.11 * usable_w,  # requested at
            0.10 * usable_w,  # attendance date
            0.12 * usable_w,  # employee
            0.12 * usable_w,  # issue type
            0.08 * usable_w,  # status
            0.10 * usable_w,  # reviewed by
            0.10 * usable_w,  # reviewed at
            0.15 * usable_w,  # reason
            0.10 * usable_w,  # decline reason
            0.02 * usable_w,  # attachment
        ]

        tbl = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        tbl.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),

            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),

            # center some columns
            ("ALIGN", (4, 1), (6, -1), "CENTER"),
            ("ALIGN", (9, 1), (9, -1), "CENTER"),
        ]))

        # Optional: color status text
        qs_list = list(qs)  # avoid re-evaluating QS by index
        for i in range(1, len(data)):
            status_val = qs_list[i - 1].status
            tbl.setStyle(TableStyle([
                ("TEXTCOLOR", (4, i), (4, i), _status_color(status_val)),
                ("FONTNAME", (4, i), (4, i), "Helvetica-Bold"),
            ]))

        elements.append(tbl)

        doc.build(elements)
        buffer.seek(0)

        filename = "Attendance_Correction_Logs.pdf"
        return FileResponse(buffer, as_attachment=True, filename=filename, content_type="application/pdf")

class EmployeeDropdownListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = EmployeeDropdownSerializer

    def get_queryset(self):
        #  only active employees
        return Employee.objects.filter(is_active=True).order_by("lname", "fname") 