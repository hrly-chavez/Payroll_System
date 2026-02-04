from rest_framework import serializers
from shared_model.models import Deduction_Type

class DeductionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Deduction_Type
        fields = '__all__'  # Sends all fields to the frontend
