from rest_framework import serializers

from .models import HomepageContent


class HomepageContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageContent
        fields = ("content", "updated_at")
        read_only_fields = ("updated_at",)
