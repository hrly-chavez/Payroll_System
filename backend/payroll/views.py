from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from shared_model.models import Deduction_Type
from .serializers import DeductionTypeSerializer

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
