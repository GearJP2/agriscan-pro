from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('samples', '0016_expand_mycotoxin_registry')]

    operations = [
        migrations.AddField(
            model_name='mycotoxinresult',
            name='is_below_lod',
            field=models.BooleanField(default=False),
        ),
    ]
