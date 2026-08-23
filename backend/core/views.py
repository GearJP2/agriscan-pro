from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import HomepageContent
from .permissions import IsAdmin
from .serializers import HomepageContentSerializer


class HomepageContentView(APIView):
    """Public read endpoint; only administrators can publish homepage content."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        record = HomepageContent.objects.filter(key="homepage").first()
        if not record:
            return Response({"content": None})
        return Response(HomepageContentSerializer(record).data)

    def put(self, request):
        if not IsAdmin().has_permission(request, self):
            return Response({"detail": "Only admin users can edit homepage content."}, status=status.HTTP_403_FORBIDDEN)
        serializer = HomepageContentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record, _ = HomepageContent.objects.update_or_create(
            key="homepage",
            defaults={"content": serializer.validated_data["content"], "updated_by": request.user},
        )
        return Response(HomepageContentSerializer(record).data)
