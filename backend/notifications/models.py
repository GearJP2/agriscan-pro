from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

from .constants import NOTIFICATION_TYPES

User = get_user_model()


class Notification(models.Model):
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_index=True,
        help_text="The user who will receive this notification"
    )
    notification_type = models.CharField(
        max_length=20, 
        choices=NOTIFICATION_TYPES,
        help_text="Category of the notification used for frontend routing and grouping"
    )
    title = models.CharField(max_length=255, help_text="Short, descriptive title of the notification")
    message = models.TextField(help_text="Detailed notification body explaining the event")
    link = models.CharField(max_length=255, blank=True, help_text="Optional frontend route to direct the user to upon click")
    metadata = models.JSONField(default=dict, blank=True, help_text="Contextual key-value pairs (e.g., sample_id, risk_level)")
    is_read = models.BooleanField(default=False, db_index=True, help_text="Indicates if the user has acknowledged this notification")
    read_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when the notification was marked as read")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when the notification was generated")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=["is_read", "read_at"])

    def __str__(self):
        return f"{self.recipient.email} - {self.title} [{self.notification_type}]"
