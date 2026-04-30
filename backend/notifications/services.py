from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Notification

User = get_user_model()


class NotificationService:
    @staticmethod
    def dispatch(
        *,
        recipient,
        notification_type: str,
        title: str,
        message: str,
        link: str = "",
        metadata: dict = None,
    ) -> Notification:
        """
        Creates a single notification for a specific user.

        Args:
            recipient (User): The user who will receive the notification.
            notification_type (str): The category of the notification (e.g., 'risk_alert', 'system').
            title (str): A short, descriptive title.
            message (str): The detailed notification body.
            link (str, optional): A frontend route to direct the user to upon click. Defaults to "".
            metadata (dict, optional): Contextual key-value pairs. Defaults to None.

        Returns:
            Notification: The newly created notification instance.
        """
        return Notification.objects.create(
            recipient=recipient,
            notification_type=notification_type,
            title=title,
            message=message,
            link=link,
            metadata=metadata or {},
        )

    @staticmethod
    def dispatch_to_role(
        *,
        role: str,
        notification_type: str,
        title: str,
        message: str,
        link: str = "",
        metadata: dict = None,
    ) -> list[Notification]:
        """
        Broadcasts a notification to every active user whose role weight is >= the specified role.

        Args:
            role (str): The minimum role required to receive this notification (e.g., 'researcher').
            notification_type (str): The category of the notification.
            title (str): A short, descriptive title.
            message (str): The detailed notification body.
            link (str, optional): A frontend route to direct the user to upon click. Defaults to "".
            metadata (dict, optional): Contextual key-value pairs. Defaults to None.

        Returns:
            list[Notification]: A list of newly created notification instances.

        Raises:
            ValueError: If the specified role is unknown or invalid.
        """
        # Determine the minimum required weight from the user model constants
        min_weight = User.USER_ROLE_WEIGHTS.get(role)
        if min_weight is None:
            raise ValueError(f"Unknown role: {role}")

        # OPTIMIZATION: Filter roles at the database level instead of loading all users into memory
        eligible_roles = [
            r for r, w in User.USER_ROLE_WEIGHTS.items() if w >= min_weight
        ]
        
        eligible_users = User.objects.filter(
            is_active=True, 
            role__in=eligible_roles
        )

        if not eligible_users:
            return []

        notifications_to_create = [
            Notification(
                recipient=user,
                notification_type=notification_type,
                title=title,
                message=message,
                link=link,
                metadata=metadata or {},
            )
            for user in eligible_users
        ]

        with transaction.atomic():
            created_notifications = Notification.objects.bulk_create(notifications_to_create)

        return created_notifications
