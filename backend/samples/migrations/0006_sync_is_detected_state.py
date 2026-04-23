# pyright: reportArgumentType=false
from django.db import migrations, models


def _add_is_detected_column(apps, schema_editor):
    table_name = "samples_mycotoxinresult"
    column_name = "is_detected"

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if column_name not in existing_columns:
        schema_editor.execute(
            "ALTER TABLE samples_mycotoxinresult "
            "ADD COLUMN is_detected boolean NOT NULL DEFAULT true;"
        )


def _remove_is_detected_column(apps, schema_editor):
    table_name = "samples_mycotoxinresult"
    column_name = "is_detected"

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if column_name in existing_columns:
        schema_editor.execute(
            "ALTER TABLE samples_mycotoxinresult DROP COLUMN is_detected;"
        )


class Migration(migrations.Migration):
    dependencies = [
        ("samples", "0005_sync_sequence_number_state"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    _add_is_detected_column,
                    _remove_is_detected_column,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="mycotoxinresult",
                    name="is_detected",
                    field=models.BooleanField(default=True),  # type: ignore[arg-type]
                ),
            ],
        ),
    ]
