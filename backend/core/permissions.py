from rest_framework import permissions

SAMPLE_ACCESS_ROLES = {'admin', 'head_researcher', 'researcher', 'research_assistant'}


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    View- and object-level permission for sample data.
    - 'user' and 'guest' roles are denied access entirely (403).
    - admin/head_researcher/researcher have full access.
    - research_assistant has read-all but write-own-only access.
    Assumes the model instance has `updated_by` and `collected_by` attributes.
    """

    def has_permission(self, request, _view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in SAMPLE_ACCESS_ROLES
        )

    def has_object_permission(self, request, view, obj):
        # Admin, Head Researcher, and Researcher have full access to any lab work
        if request.user.role in ['admin', 'head_researcher', 'researcher']:
            return True

        # Read permissions are allowed to any authenticated user
        if request.method in permissions.SAFE_METHODS:
            return True

        # Others (Research Assistant, etc.) can only edit if they are the owner/collected_by
        return obj.updated_by == request.user or obj.collected_by == request.user.username
