from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Centralized audit log for tracking critical changes across all models
    (e.g., sample deletions, role updates).

    Lives in `core` rather than `accounts` because it is a cross-cutting
    concern referenced by multiple apps (samples, accounts, etc.).
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=50)  # e.g., 'create', 'update', 'delete'
    model_name = models.CharField(max_length=100)  # e.g., 'Sample', 'User'
    object_id = models.CharField(max_length=255)
    changes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else "System"
        return (
            f"{actor_name} performed {self.action} on "
            f"{self.model_name} {self.object_id} at {self.timestamp}"
        )
