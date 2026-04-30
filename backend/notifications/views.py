from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API ViewSet for managing user notifications.
    Provides read-only access (list, retrieve) and custom actions to manage read state.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Retrieves the queryset of notifications for the authenticated user.

        Returns:
            QuerySet[Notification]: A queryset filtered to include only notifications
            where the recipient is the currently authenticated user.
        """
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        """
        Returns the count of unread notifications for the user.
        This endpoint is optimized for polling (e.g., every 30s).

        Args:
            request (Request): The incoming HTTP request.

        Returns:
            Response: A JSON response containing the unread count `{"count": int}`.
        """
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        """
        Marks a specific notification as read.
        Updates `is_read` to True and sets `read_at` to the current timestamp.

        Args:
            request (Request): The incoming HTTP request.
            pk (str, optional): The primary key of the notification.

        Returns:
            Response: A JSON representation of the updated notification.
        """
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
            
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        """
        Marks all unread notifications for the user as read in a single bulk operation.

        Args:
            request (Request): The incoming HTTP request.

        Returns:
            Response: A JSON response containing the number of updated records `{"updated": int}`.
        """
        updated_count = self.get_queryset().filter(is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"updated": updated_count})
