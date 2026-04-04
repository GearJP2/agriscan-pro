from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0003_alter_mycotoxinresult_intensity'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='mycotoxinresult',
            name='concentration',
        ),
    ]
