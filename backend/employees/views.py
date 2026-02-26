from rest_framework import viewsets, status, generics, permissions
from shared_model.models import *
from .serializers import *
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.permissions import IsRole;
import random, string
from rest_framework.views import APIView
from decimal import Decimal
from django.db import transaction
from django.utils.timezone import now
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from shared_model.signals import create_audit_log
from datetime import timedelta
from django.utils.http import urlsafe_base64_encode
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.template.loader import render_to_string
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_decode

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

        # Generate strong random password (12 characters, mix of letters, digits, punctuation)
        new_password = ''.join(
            secrets.choice(string.ascii_letters + string.digits + string.punctuation)
            for _ in range(12)
        )

        # Hash password properly
        user.set_password(new_password)

        # Attach current user for AuditLog
        user._current_user = request.user
        user.save()

        create_audit_log(
            instance=user,
            action="RESET_PASSWORD",
            old_data="",
            new_data="Password was reset by admin"
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

        if user.is_active:
            user.is_active = False
            action_name = "DEACTIVATED"
        else:
            user.is_active = True
            action_name = "REACTIVATED"

        user.save()

        # Audit log
        create_audit_log(
            instance=user,
            action=action_name,
            old_data=f"is_active: {not user.is_active}",
            new_data=f"is_active: {user.is_active}"
        )

        return Response(
            {"detail": f"User successfully {action_name.lower()}.", "is_active": user.is_active},
            status=status.HTTP_200_OK
        )
        
#done logs
#employee details crud
class EmployeeViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsRole]
    allowed_roles = ["ADMIN", "SUPER_ADMIN"]
    queryset = Employee.objects.filter(is_active=True)
    
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
        salary_data = data.pop("salary", None)
        contributions_data = data.pop("contributions", [])
        allowances_data = data.pop("allowances", [])
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
        if salary_data:
            salary_data["employee"] = employee.id
            salary_serializer = EmployeeSalarySerializer(data=salary_data, context={"_current_user": signed_in_user})
            salary_serializer.is_valid(raise_exception=True)
            salary_obj = salary_serializer.save()
        else:
            salary_obj = None

        # -----------------------------
        # 5. Create Contributions
        # -----------------------------
        for c in contributions_data:
            c["employee"] = employee.id
            serializer = EmployeeDeductionCreateSerializer(data=c)
            serializer.is_valid(raise_exception=True)
            serializer.save(_current_user=signed_in_user)

        # -----------------------------
        # 6. Create Allowances
        # -----------------------------
        print("ALLOWANCES RECEIVED:", allowances_data)

        for a in allowances_data:
            a["employee"] = employee.id
            serializer = EmployeeAllowanceCreateSerializer(
                data=a,
                context={"_current_user": signed_in_user}
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
        return Response({
            "message": "Employee created successfully",
            "employee_id": employee.id,
            "username": username,
            "password": password
        }, status=201)

    
    # -------------------
    # CREATE EMPLOYEE
    # -------------------
    def create(self, request, *args, **kwargs):
        serializer = EmployeeCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Role restriction
        signed_in_user = request.user
        requested_role = request.data.get("role", "EMPLOYEE")
        if signed_in_user.role == "ADMIN" and requested_role != "EMPLOYEE":
            return Response({"error": "ADMINs can only create EMPLOYEE users."}, status=403)
        if signed_in_user.role == "SUPER_ADMIN" and requested_role not in ["ADMIN", "SUPER_ADMIN"]:
            return Response({"error": "SUPER_ADMIN can only create ADMIN or SUPER_ADMIN users."}, status=403)
        if signed_in_user.role not in ["ADMIN", "SUPER_ADMIN"]:
            return Response({"error": "You do not have permission to create users."}, status=403)

        # Save employee WITH _current_user
        employee = serializer.save(_current_user=request.user)

        # Generate username and password
        username = f"{employee.fname.lower()}{employee.id}"
        password = "".join(random.choices(string.ascii_letters + string.digits, k=8))

        # Create user manually and attach _current_user BEFORE saving
        user = User(
            user_name=username,
            role=requested_role,
            employee=employee,
        )
        user.set_password(password)
        user._current_user = request.user
        user.save()  # triggers post_save signal, AuditLog sees _current_user

        return Response({
            "message": "Employee and user created successfully",
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
#forgot pass
#undone logs
User = get_user_model()

class ForgotPasswordView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get("username")

        if not username:
            return Response(
                {"detail": "Username is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.select_related("employee").get(user_name=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "If the account exists, a reset link has been sent."},
                status=status.HTTP_200_OK
            )

        # 🔐 Make sure user has linked employee + email
        if not user.employee or not user.employee.email:
            return Response(
                {"detail": "If the account exists, a reset link has been sent."},
                status=status.HTTP_200_OK
            )

        email = user.employee.email

        # Generate token
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        reset_url = f"http://localhost:3000/reset-password/{uid}/{token}/"

        send_mail(
            subject="Payroll System Password Reset",
            message=f"""
                        Hello {user.user_name},

                        Click the link below to reset your password:

                        {reset_url}

                        If you did not request this, please ignore this email.
                        """,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
        )

        return Response(
            {"detail": "If the account exists, a reset link has been sent."},
            status=status.HTTP_200_OK
        )

User = get_user_model()

class ResetPasswordConfirmView(APIView):
    permission_classes = []

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        password = request.data.get("password")

        if not uid or not token or not password:
            return Response(
                {"detail": "Invalid request."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_id = urlsafe_base64_decode(uid).decode()
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response(
                {"detail": "Invalid link."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Token expired or invalid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(password)
        user.save()

        return Response(
            {"detail": "Password reset successful."},
            status=status.HTTP_200_OK
        )

#done logs
#employee salary
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
            salary_amount=new_salary.base_rate,
            effective_from=new_salary.effective_from,
            user=request.user
        )

        return Response(self.get_serializer(new_salary).data, status=status.HTTP_201_CREATED)

    def _recompute_percentage_deductions(self, employee_id, salary_amount, effective_from, user):
        from shared_model.models import Employee_Deduction, Deduction_Type
        from decimal import Decimal
        from datetime import timedelta

        salary_amount = Decimal(str(salary_amount))

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
        old_data = ""
        new_data = ""

        # UPDATE logs: convert dicts to formatted strings
        if log.action == "UPDATE":
            if isinstance(log.old_data, dict):
                old_data = ", ".join([f'{k}: "{v}"' for k, v in log.old_data.items()])
            else:
                old_data = str(log.old_data)

            if isinstance(log.new_data, dict):
                new_data = ", ".join([f'{k}: "{v}"' for k, v in log.new_data.items()])
            else:
                new_data = str(log.new_data)

        user_name = log.user.user_name if log.user else ""

        serialized_logs.append({
            "id": log.id,
            "user": user_name,
            "action": log.action,
            "model_name": log.model_name,
            "old_data": old_data,
            "new_data": new_data,
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
