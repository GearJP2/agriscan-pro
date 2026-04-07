from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0004_remove_mycotoxinresult_concentration'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE samples_sample "
                        "ADD COLUMN IF NOT EXISTS sequence_number integer NOT NULL DEFAULT 0;"
                    ),
                    reverse_sql=(
                        "ALTER TABLE samples_sample "
                        "DROP COLUMN IF EXISTS sequence_number;"
                    ),
                ),
                migrations.RunSQL(
                    sql=(
                        "CREATE INDEX IF NOT EXISTS samples_sample_sequence_number_"
                        "13f1745a ON samples_sample (sequence_number);"
                    ),
                    reverse_sql=(
                        "DROP INDEX IF EXISTS samples_sample_sequence_number_13f1745a;"
                    ),
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='sample',
                    name='sequence_number',
                    field=models.IntegerField(default=0, db_index=True),
                ),
            ],
        ),
    ]
