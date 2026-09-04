from django.db import migrations, models


def migrate_legacy_purposes(apps, schema_editor):
    Sample = apps.get_model('samples', 'Sample')
    Sample.objects.filter(purpose__in=['routine', 'target surveillance']).update(purpose='research')
    Sample.objects.filter(purpose='complaint driven').update(purpose='customer')


class Migration(migrations.Migration):
    dependencies = [
        ('samples', '0014_sample_food_feed_registration_fields'),
    ]

    operations = [
        migrations.RunPython(migrate_legacy_purposes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='sample',
            name='purpose',
            field=models.CharField(
                blank=True,
                choices=[('research', 'Research'), ('customer', 'Customer')],
                max_length=50,
                null=True,
            ),
        ),
    ]
