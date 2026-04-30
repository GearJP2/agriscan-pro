"""Constants for the accounts app, including role definitions and weights."""

from django.utils.translation import gettext_lazy as _

ROLE_CHOICES = (
    ("admin", _("Admin")),
    ("head_researcher", _("Head Researcher")),
    ("researcher", _("Researcher")),
    ("research_assistant", _("Research Assistant")),
    ("user", _("User")),
    ("guest", _("Guest")),
)

USER_ROLE_WEIGHTS = {
    "admin": 100,
    "head_researcher": 80,
    "researcher": 60,
    "research_assistant": 40,
    "user": 20,
    "guest": 0,
}
