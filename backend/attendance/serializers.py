from rest_framework import serializers
from shared_model.models import *


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"


class PunchInSerializer(serializers.Serializer):
    """
    No input fields needed.
    We use request.user.employee and server time.
    """
    def validate(self, attrs):
        return attrs


class PunchOutSerializer(serializers.Serializer):
    """
    No input fields needed.
    We use request.user.employee and server time.
    """
    def validate(self, attrs):
        return attrs
