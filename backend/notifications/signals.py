from django.db.models.signals import post_save
from django.dispatch import receiver

from samples.models import MycotoxinResult
from .services import NotificationService


@receiver(post_save, sender=MycotoxinResult)
def create_risk_alert_notification(sender, instance, created, **kwargs):
    if not created:
        return

    if instance.risk_level in ("high", "critical"):
        title = f"Risk Alert: {instance.risk_level.capitalize()} Mycotoxin Detected"
        message = (
            f"Sample {instance.sample.sample_id} tested {instance.risk_level} "
            f"for {instance.toxin_type} ({instance.value} {instance.unit})."
        )
        # Link to the sample details page on the frontend
        link = f"/samples/{instance.sample.id}"
        
        NotificationService.dispatch_to_role(
            role="researcher",
            notification_type="risk_alert",
            title=title,
            message=message,
            link=link,
            metadata={
                "sample_id": str(instance.sample.id),
                "sample_display_id": instance.sample.sample_id,
                "toxin_type": instance.toxin_type,
                "risk_level": instance.risk_level,
                "value": instance.value,
                "unit": instance.unit,
            },
        )
