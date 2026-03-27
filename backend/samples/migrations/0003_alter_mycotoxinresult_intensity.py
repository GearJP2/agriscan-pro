# Generated manually to support exact lab concentration storage in intensity

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('samples', '0002_add_concentration_to_mycotoxin_result'),
    ]

    operations = [
        migrations.AlterField(
            model_name='mycotoxinresult',
            name='intensity',
            field=models.FloatField(validators=[django.core.validators.MinValueValidator(0)]),
        ),
    ]
