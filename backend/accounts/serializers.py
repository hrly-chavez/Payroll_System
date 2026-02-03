from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Make the login field your USERNAME_FIELD
    username_field = "user_name"
