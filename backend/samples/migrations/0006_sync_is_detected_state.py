from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0005_sync_sequence_number_state'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE samples_mycotoxinresult '
                        'ADD COLUMN IF NOT EXISTS is_detected boolean NOT NULL DEFAULT true;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE samples_mycotoxinresult '
                        'DROP COLUMN IF EXISTS is_detected;'
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='mycotoxinresult',
                    name='is_detected',
                    field=models.BooleanField(default=True),
                ),
            ],
        ),
    ]
