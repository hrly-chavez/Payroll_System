from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from shared_model.models import *
from .serializers import *
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.shortcuts import get_object_or_404




# List and Create
class DeductionListCreateView(generics.ListCreateAPIView):
    queryset = Deduction_Type.objects.all().order_by('-create_at')
    serializer_class = DeductionTypeSerializer

# Retrieve, Update, Delete
class DeductionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Deduction_Type.objects.all()
    serializer_class = DeductionTypeSerializer

# Optional: Update only 'is_active' status
class DeductionUpdateStatusView(APIView):
    def patch(self, request, pk):
        try:
            deduction = Deduction_Type.objects.get(pk=pk)
        except Deduction_Type.DoesNotExist:
            return Response({"error": "Deduction not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Update only is_active
        deduction.is_active = request.data.get('is_active', deduction.is_active)
        deduction.save()
        serializer = DeductionTypeSerializer(deduction)
        return Response(serializer.data, status=status.HTTP_200_OK)



#==========================================PAYROLL PERIOD========================================
#Making Payroll Period
class PayrollPeriodListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayrollPeriodCreateSerializer
    queryset = Payroll_Period.objects.all().order_by("-start_date")

    def perform_create(self, serializer):
        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data["end_date"]

        # Example code format: PP-20260201-20260215
        code = f"PP-{start_date.strftime('%Y%m%d')}-{end_date.strftime('%Y%m%d')}"

        serializer.save(
            code=code,
            status="Open",
        )

#for clicking the payroll period (shows modal)
class PayrollPeriodEligibleEmployeesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, period_id):
        period = get_object_or_404(Payroll_Period, id=period_id)

        # 1) employees who already have payroll in this period
        payroll_employee_ids = Payroll.objects.filter(
            payroll_period=period
        ).values_list("employee_id", flat=True)

        # 2) eligible employees = no payroll yet (your current behavior)
        eligible_employees = Employee.objects.exclude(
            id__in=payroll_employee_ids
        ).select_related("department")

        # 3) lazy-create PayrollPeriodEmployee rows for eligible employees
        existing_employee_ids = set(
            PayrollPeriodEmployee.objects.filter(period=period)
            .values_list("employee_id", flat=True)
        )

        to_create = [
            PayrollPeriodEmployee(period=period, employee=e)
            for e in eligible_employees
            if e.id not in existing_employee_ids
        ]

        if to_create:
            PayrollPeriodEmployee.objects.bulk_create(
                to_create,
                ignore_conflicts=True
            )

        # 4) return PayrollPeriodEmployee rows (so we can include status)
        ppe_qs = PayrollPeriodEmployee.objects.filter(
            period=period
        ).exclude(
            employee_id__in=payroll_employee_ids
        ).select_related(
            "employee", "employee__department"
        ).order_by(
            "employee__lname", "employee__fname"
        )

        return Response({
            "period": PayrollPeriodCreateSerializer(period).data,
            "eligible_employees": EligibleEmployeeSerializer(ppe_qs, many=True).data
        })
    
#==========================================PAYRULE========================================

# List and Create
class PayRuleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayRuleSerializer
    queryset = Pay_Rule.objects.all().order_by('-created_at')

# Retrieve, Update, Delete
class PayRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PayRuleSerializer
    queryset = Pay_Rule.objects.all()

# Optional: Update only 'is_active' status
class PayRuleUpdateStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        rule = get_object_or_404(Pay_Rule, pk=pk)
        rule.is_active = request.data.get('is_active', rule.is_active)
        rule.save()
        serializer = PayRuleSerializer(rule)
        return Response(serializer.data, status=status.HTTP_200_OK)