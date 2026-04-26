from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    EmailChangeRequest,
    PasswordResetOTP,
    User,
    UserActionLog,
    UserAuthProvider,
)

admin.site.register(User, UserAdmin)
admin.site.register(UserActionLog)
admin.site.register(PasswordResetOTP)
admin.site.register(EmailChangeRequest)


@admin.register(UserAuthProvider)
class UserAuthProviderAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "provider",
        "provider_user_id",
        "email_verified",
        "linked_at",
        "last_used_at",
    )
    list_filter = ("provider", "email_verified")
    search_fields = ("user__email", "user__username", "provider_user_id", "email")
