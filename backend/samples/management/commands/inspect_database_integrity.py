"""Read-only schema and growth inventory; no credentials or row payloads are printed."""
import json

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.models import Count, Q
from django.db.models.functions import Lower


class Command(BaseCommand):
    help = 'Report physical columns/constraints, row counts and unresolved legacy records (read-only).'

    def handle(self, *args, **options):
        from accounts.models import User
        from samples.models import Sample

        report = {'vendor': connection.vendor, 'tables': {}}
        with connection.cursor() as cursor:
            for model in apps.get_models(include_auto_created=True):
                if model._meta.swapped or not model._meta.managed:
                    continue
                table = model._meta.db_table
                entry = {
                    'rows': model.objects.count(),
                    'columns': [
                        {'name': field.name, 'type_code': field.type_code, 'nullable': field.null_ok,
                         'default': field.default}
                        for field in connection.introspection.get_table_description(cursor, table)
                    ],
                    'constraints': connection.introspection.get_constraints(cursor, table),
                }
                if connection.vendor == 'postgresql':
                    cursor.execute('SELECT pg_total_relation_size(%s::regclass)', [table])
                    entry['total_bytes'] = cursor.fetchone()[0]
                report['tables'][table] = entry
        report['unresolved_legacy_ownership'] = Sample.objects.filter(recorded_by__isnull=True).count()
        report['missing_food_feed_type'] = Sample.objects.filter(
            Q(food_feed_type__isnull=True) | Q(food_feed_type='')
        ).count()
        report['case_equivalent_email_groups'] = (
            User.objects.annotate(email_key=Lower('email')).values('email_key')
            .annotate(n=Count('pk')).filter(n__gt=1).count()
        )
        self.stdout.write(json.dumps(report, indent=2, default=str))
