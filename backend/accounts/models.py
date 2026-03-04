from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

# Create your models here.

class User(AbstractUser):
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('head_researcher', 'Head Researcher'),
        ('researcher', 'Researcher'),
        ('research_assistant', 'Research Assistant'),
        ('user', 'User'),
        ('guest', 'Guest'),
    )
    name = models.CharField(_("Full Name"), max_length=255)
    email = models.EmailField(_("Email Address"), unique=True)
    role = models.CharField(max_length=50, choices=ROLE_CHOICES, default='user')
    
    # We'll use email for logging in as well as username, but username is still required by AbstractUser
    # We can keep the default username field from AbstractUser as unique=True, which is the default.

class UserActionLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='actions_performed')
    target_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='actions_received')
    action = models.CharField(max_length=50)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.actor} performed {self.action} on {self.target_user} at {self.timestamp}"
