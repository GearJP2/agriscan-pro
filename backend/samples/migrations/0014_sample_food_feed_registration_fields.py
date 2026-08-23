from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('samples', '0013_externaldatacache'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='sample',
            name='food_feed_type',
            field=models.CharField(blank=True, choices=[('food', 'Food'), ('feed', 'Feed')], max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='sample',
            name='sub_type',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='sample',
            name='received_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='sample',
            name='recorded_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='samples_recorded', to=settings.AUTH_USER_MODEL),
        ),
    ]
