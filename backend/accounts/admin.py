from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, UserActionLog, PasswordResetOTP, EmailChangeRequest

admin.site.register(User, UserAdmin)
admin.site.register(UserActionLog)
admin.site.register(PasswordResetOTP)
admin.site.register(EmailChangeRequest)

