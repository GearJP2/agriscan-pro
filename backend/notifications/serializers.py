from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for the Notification model.
    Provides a read-only representation of a notification instance.
    """
    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "title",
            "message",
            "link",
            "metadata",
            "is_read",
            "read_at",
            "created_at",
        ]
        read_only_fields = fields
