from django.db.models.signals import post_save
from django.dispatch import receiver

from samples.models import MycotoxinResult
from .services import notify_risk_change


@receiver(post_save, sender=MycotoxinResult)
def create_risk_alert_notification(sender, instance, created, **kwargs):
    notify_risk_change(instance, None if created else getattr(instance, '_previous_risk', instance.risk_level))
