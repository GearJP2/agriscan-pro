"""Snapshots for the existing audit store; callers own the write transaction."""
import json

from django.core.serializers.json import DjangoJSONEncoder

from .models import AuditLog


def row_snapshot(instance):
    return json.loads(json.dumps(
        {field.attname: getattr(instance, field.attname) for field in instance._meta.concrete_fields},
        cls=DjangoJSONEncoder,
    ))


def audit_result_change(result, actor, before):
    after = row_snapshot(result)
    if before != after:
        AuditLog.objects.create(
            actor=actor, action='update' if before else 'create', model_name='MycotoxinResult',
            object_id=str(result.pk),
            changes={'sample_id': result.sample.sample_id, 'before': before, 'after': after},
        )


def archive_sample_for_deletion(sample, actor):
    from notifications.models import Notification

    context = getattr(sample, 'prediction_context', None)
    AuditLog.objects.create(
        actor=actor, action='delete_snapshot', model_name='Sample', object_id=sample.sample_id,
        changes={
            'sample': row_snapshot(sample),
            'mycotoxin_results': [row_snapshot(result) for result in sample.mycotoxin_results.all()],
            'process_logs': [row_snapshot(log) for log in sample.process_logs.all()],
            'prediction_context': row_snapshot(context) if context else None,
        },
    )
    Notification.objects.filter(metadata__sample_id=str(sample.pk)).update(link='')
