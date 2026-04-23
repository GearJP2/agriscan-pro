# pyright: reportArgumentType=false
from django.db import migrations, models


def _add_sequence_number_column(apps, schema_editor):
    table_name = "samples_sample"
    column_name = "sequence_number"
    index_name = "samples_sample_sequence_number_13f1745a"

    with schema_editor.connection.cursor() as cursor:
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if column_name not in existing_columns:
        schema_editor.execute(
            "ALTER TABLE samples_sample "
            "ADD COLUMN sequence_number integer NOT NULL DEFAULT 0;"
        )

    with schema_editor.connection.cursor() as cursor:
        existing_indexes = schema_editor.connection.introspection.get_constraints(
            cursor, table_name
        )

    if index_name not in existing_indexes:
        schema_editor.execute(
            "CREATE INDEX samples_sample_sequence_number_13f1745a "
            "ON samples_sample (sequence_number);"
        )


def _remove_sequence_number_column(apps, schema_editor):
    table_name = "samples_sample"
    column_name = "sequence_number"
    index_name = "samples_sample_sequence_number_13f1745a"

    with schema_editor.connection.cursor() as cursor:
        existing_constraints = schema_editor.connection.introspection.get_constraints(
            cursor, table_name
        )
        existing_columns = {
            column.name
            for column in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

    if index_name in existing_constraints:
        schema_editor.execute("DROP INDEX samples_sample_sequence_number_13f1745a;")

    if column_name in existing_columns:
        schema_editor.execute("ALTER TABLE samples_sample DROP COLUMN sequence_number;")


class Migration(migrations.Migration):
    dependencies = [
        ("samples", "0004_remove_mycotoxinresult_concentration"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    _add_sequence_number_column,
                    _remove_sequence_number_column,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="sample",
                    name="sequence_number",
                    field=models.IntegerField(default=0, db_index=True),
                ),
            ],
        ),
    ]
