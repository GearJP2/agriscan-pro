from typing import Any, Sequence
from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Notification

User = get_user_model()


def notify_sample_risk_changes(
    sample: Any,
    results_with_previous_risks: Sequence[tuple[Any, str | None]],
    *,
    recipient_users: Sequence[Any] | None = None,
) -> list[Notification]:
    """Group elevated toxin alerts at the sample level to prevent notification explosion.

    If a sample has multiple newly elevated toxins (high/critical), dispatches a single
    consolidated notification summarizing all elevated toxins on that sample.
    If a sample has only one elevated toxin, dispatches the standard single-toxin alert.
    """
    if sample.sample_id.startswith("TEST-"):
        return []

    elevated = [
        result
        for result, previous_risk in results_with_previous_risks
        if result.risk_level in {"high", "critical"} and previous_risk != result.risk_level
    ]

    if not elevated:
        return []

    if len(elevated) == 1:
        result = elevated[0]
        return NotificationService.dispatch_to_role(
            role="researcher",
            notification_type="risk_alert",
            title=f"Risk Alert: {result.risk_level.capitalize()} Mycotoxin Detected",
            message=(
                f"Sample {sample.sample_id} tested {result.risk_level} "
                f"for {result.toxin_type} ({result.value} {result.unit})."
            ),
            link=f"/samples/{sample.id}",
            metadata={
                "sample_id": str(sample.id),
                "sample_display_id": sample.sample_id,
                "toxin_type": result.toxin_type,
                "risk_level": result.risk_level,
                "value": result.value,
                "unit": result.unit,
            },
            recipient_users=recipient_users,
        )

    # 2+ elevated toxins on this sample: group into one alert
    overall_risk = "critical" if any(r.risk_level == "critical" for r in elevated) else "high"
    toxin_details = [
        f"{r.toxin_type} ({r.value} {r.unit} - {r.risk_level})"
        for r in elevated
    ]
    toxin_summary = ", ".join(toxin_details)

    return NotificationService.dispatch_to_role(
        role="researcher",
        notification_type="risk_alert",
        title=f"Risk Alert: {overall_risk.capitalize()} Mycotoxins Detected ({len(elevated)} Toxins)",
        message=(
            f"Sample {sample.sample_id} tested elevated for {len(elevated)} toxins: "
            f"{toxin_summary}."
        ),
        link=f"/samples/{sample.id}",
        metadata={
            "sample_id": str(sample.id),
            "sample_display_id": sample.sample_id,
            "risk_level": overall_risk,
            "toxin_count": len(elevated),
            "toxins": [
                {
                    "toxin_type": r.toxin_type,
                    "risk_level": r.risk_level,
                    "value": r.value,
                    "unit": r.unit,
                }
                for r in elevated
            ],
        },
        recipient_users=recipient_users,
    )


def notify_risk_change(result, previous_risk):
    """Persist inbox rows in the caller's transaction; retries of the same state are silent."""
    return notify_sample_risk_changes(result.sample, [(result, previous_risk)])


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

    @classmethod
    def get_eligible_users(cls, role: str) -> list[Any]:
        """Fetch all active users matching or exceeding the given role weight."""
        min_weight = User.USER_ROLE_WEIGHTS.get(role)
        if min_weight is None:
            raise ValueError(f"Unknown role: {role}")

        eligible_roles = [
            r for r, w in User.USER_ROLE_WEIGHTS.items() if w >= min_weight
        ]
        return list(User.objects.filter(is_active=True, role__in=eligible_roles))

    @classmethod
    def dispatch_to_role(
        cls,
        *,
        role: str,
        notification_type: str,
        title: str,
        message: str,
        link: str = "",
        metadata: dict = None,
        recipient_users: Sequence[Any] | None = None,
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
            recipient_users (Sequence[User], optional): Pre-resolved eligible users. If omitted,
                queries the database for eligible users.

        Returns:
            list[Notification]: A list of newly created notification instances.

        Raises:
            ValueError: If the specified role is unknown or invalid.
        """
        if recipient_users is None:
            recipient_users = cls.get_eligible_users(role)

        if not recipient_users:
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
            for user in recipient_users
        ]

        with transaction.atomic():
            created_notifications = Notification.objects.bulk_create(notifications_to_create)

        return created_notifications
