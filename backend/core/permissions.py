from rest_framework import permissions

ADMIN_ROLES = {"admin"}
ADMIN_OR_RESEARCH_ROLES = {"admin", "head_researcher", "researcher"}
SAMPLE_ACCESS_ROLES = {"admin", "head_researcher", "researcher", "research_assistant"}


def _is_authenticated_with_role(user, allowed_roles: set[str]) -> bool:
    """Return whether the user is authenticated and matches one of the allowed roles."""
    if not user or not user.is_authenticated:
        return False

    if user.is_superuser or user.is_staff:
        return True

    return getattr(user, "role", None) in allowed_roles


class IsAdmin(permissions.BasePermission):
    """Allow access only to admin users."""

    message = "Only admin users can perform this action."

    def has_permission(self, request, _view):
        return _is_authenticated_with_role(request.user, ADMIN_ROLES)


class IsAdminOrResearchRole(permissions.BasePermission):
    """Allow access only to admin, head_researcher, and researcher roles."""

    message = "You do not have permission to view the user directory."

    def has_permission(self, request, _view):
        return _is_authenticated_with_role(request.user, ADMIN_OR_RESEARCH_ROLES)


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    View- and object-level permission for sample data.
    - 'user' and 'guest' roles are denied access entirely (403).
    - admin/head_researcher/researcher have full access.
    - research_assistant has read-all but write-own-only access.
    Assumes the model instance has `updated_by` and `collected_by` attributes.
    """

    def has_permission(self, request, _view):
        return _is_authenticated_with_role(request.user, SAMPLE_ACCESS_ROLES)

    def has_object_permission(self, request, view, obj):
        # Admin, Head Researcher, and Researcher have full access to any lab work
        if request.user.role in ["admin", "head_researcher", "researcher"]:
            return True

        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True

        # Others (Research Assistant, etc.) can only edit if they are the owner/collected_by
        return obj.updated_by == request.user or obj.collected_by == request.user.username
