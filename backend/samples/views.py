import logging

from celery.result import AsyncResult
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework import filters, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import SampleAlreadyExists
from core.models import AuditLog
from core.permissions import IsAdmin, IsOwnerOrAdmin

from .models import MycotoxinResult, ProcessLog, Sample
from .services.ingestion_service import SampleIngestionService
from .services.sample_service import SampleService
from .services.s3_service import generate_upload_url
from .serializers import (
    MycotoxinResultSerializer,
    ProcessLogSerializer,
    SampleCreateUpdateSerializer,
    SampleListSerializer,
    SampleSerializer,
)
from .tasks import process_sample_file
from .services.analytics_service import AnalyticsService

logger = logging.getLogger('agriscan.samples')

# ─── Tunable constants ────────────────────────────────────────────────────────
BULK_DELETE_LIMIT = 500
RECENT_ALERTS_LIMIT = 10


class SampleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing samples.
    Provides CRUD operations and filtering capabilities.
    """
    queryset = (
        Sample.objects
        .select_related('updated_by')
        .prefetch_related('process_logs', 'mycotoxin_results')
        .all()
    )
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sample_id', 'region', 'vegetation_variety']
    ordering_fields = ['collection_date', 'created_at', 'status']
    ordering = ['-collection_date']
    lookup_field = 'sample_id'

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        return [permission() for permission in self.permission_classes]

    def get_serializer_class(self):
        if self.action == 'list':
            return SampleListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SampleCreateUpdateSerializer
        return SampleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by status
        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = status_param.split(',')
            queryset = queryset.filter(status__in=statuses)
        
        # Filter by region
        region = self.request.query_params.get('region')
        if region:
            queryset = queryset.filter(region=region)

        # Filter by province
        province = self.request.query_params.get('province')
        if province:
            queryset = queryset.filter(province=province)
        
        # Filter by vegetation variety
        vegetation = self.request.query_params.get('vegetation')
        if vegetation:
            queryset = queryset.filter(vegetation_variety=vegetation)
        
        # Filter by date range
        date_from = self.request.query_params.get('date_from')
        if date_from:
            queryset = queryset.filter(collection_date__gte=date_from)
        
        date_to = self.request.query_params.get('date_to')
        if date_to:
            queryset = queryset.filter(collection_date__lte=date_to)

        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            requested_levels = set(risk_level.split(','))
            risk_filter = Q()
            if 'high' in requested_levels:
                risk_filter |= Q(mycotoxin_results__risk_level__in=['high', 'critical'])
            if requested_levels.intersection({'low', 'medium'}):
                risk_filter |= Q(mycotoxin_results__risk_level='detected')
            if 'safe' in requested_levels:
                risk_filter |= (
                    Q(mycotoxin_results__risk_level='safe')
                    | Q(mycotoxin_results__isnull=True)
                )

            if risk_filter:
                queryset = queryset.filter(risk_filter).distinct()
        
        return queryset

    def perform_create(self, serializer):
        sample = serializer.save(updated_by=self.request.user)
        logger.info(
            'sample.created',
            extra={'sample_id': sample.sample_id, 'user': self.request.user.username},
        )
        # Create initial process log for new samples
        if not sample.process_logs.exists():
            ProcessLog.objects.create(
                sample=sample,
                state='registered',
                notes='Sample created',
                conducted_by=self.request.user.username
            )

    def perform_update(self, serializer):
        sample = serializer.save(updated_by=self.request.user)
        logger.info(
            'sample.updated',
            extra={'sample_id': sample.sample_id, 'user': self.request.user.username},
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Collect audit data before CASCADE deletion removes related records
        process_log_count = instance.process_logs.count()
        mycotoxin_count = instance.mycotoxin_results.count()
        sample_id = instance.sample_id
        logger.warning(
            'sample.deleted',
            extra={
                'sample_id': sample_id,
                'region': instance.region,
                'province': instance.province,
                'vegetation_variety': instance.vegetation_variety,
                'collection_date': str(instance.collection_date),
                'process_logs_deleted': process_log_count,
                'mycotoxin_results_deleted': mycotoxin_count,
                'deleted_by': request.user.username,
            },
        )

        AuditLog.objects.create(
            actor=request.user,
            action='delete',
            model_name='Sample',
            object_id=sample_id,
            changes={
                'region': instance.region,
                'province': instance.province,
                'process_logs_deleted': process_log_count,
                'mycotoxin_results_deleted': mycotoxin_count,
            },
        )

        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get dashboard statistics"""
        stats = Sample.objects.aggregate(
            total_samples=Count('id'),
            completed=Count('id', filter=Q(status='completed')),
            flagged=Count('id', filter=Q(status='flagged')),
            pending=Count('id', filter=Q(status='pending')),
            high_risk=Count(
                'id',
                filter=Q(mycotoxin_results__risk_level__in=['high', 'critical']),
                distinct=True,
            ),
        )
        return Response(stats)

    @action(detail=False, methods=['get'])
    def recent_alerts(self, request):
        """Get recently flagged samples"""
        recent = Sample.objects.filter(
            status='flagged'
        ).order_by('-updated_at')[:RECENT_ALERTS_LIMIT]
        serializer = SampleListSerializer(recent, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_process_log(self, request, sample_id=None):
        """Add a process log entry to a sample"""
        sample = self.get_object()
        serializer = ProcessLogSerializer(data=request.data)
        if serializer.is_valid():
            process_log = serializer.save(sample=sample)
            logger.info(
                'sample.process_log.added',
                extra={'sample_id': sample.sample_id, 'state': process_log.state},
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create samples, delegating orchestration to the service layer."""
        data = request.data if isinstance(request.data, list) else [request.data]

        # Pre-flight: reject IDs that already exist (409 instead of 400).
        incoming_ids = [
            item.get('sample_id')
            for item in data
            if isinstance(item, dict) and item.get('sample_id')
        ]
        if incoming_ids:
            existing = list(
                Sample.objects.filter(sample_id__in=incoming_ids)
                .values_list('sample_id', flat=True)
            )
            if existing:
                raise SampleAlreadyExists(
                    detail=f"Sample ID(s) already exist: {', '.join(existing)}"
                )

        serializer = SampleCreateUpdateSerializer(data=data, many=True)
        if not serializer.is_valid():
            logger.error(
                'sample.bulk_create.validation_error',
                extra={'error_count': len(serializer.errors), 'user': request.user.username},
            )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        samples = SampleService.bulk_create_samples(
            serializer.validated_data,
            user=request.user,
            batch_size=len(data),
        )

        logger.info(
            'sample.bulk_created',
            extra={'count': len(samples), 'user': request.user.username},
        )
        return Response(
            SampleSerializer(samples, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def add_mycotoxin_result(self, request, sample_id=None):
        """Add a mycotoxin test result to a sample"""
        sample = self.get_object()
        serializer = MycotoxinResultSerializer(data=request.data)
        if serializer.is_valid():
            response_status = status.HTTP_201_CREATED
            with transaction.atomic():
                toxin_type = serializer.validated_data['toxin_type']
                existing = (
                    sample.mycotoxin_results
                    .select_for_update()
                    .filter(toxin_type=toxin_type)
                    .first()
                )
                if existing:
                    serializer = MycotoxinResultSerializer(
                        existing,
                        data=request.data,
                        partial=True,
                    )
                    serializer.is_valid(raise_exception=True)
                    result = serializer.save(sample=sample)
                    response_status = status.HTTP_200_OK
                else:
                    result = serializer.save(sample=sample)

                # If results are recorded, mark the sample workflow as completed.
                if sample.status != 'completed':
                    sample.status = 'completed'
                    sample.updated_by = request.user
                    sample.save(update_fields=['status', 'updated_by', 'updated_at'])

                latest_log = sample.process_logs.order_by('-timestamp').first()
                if not latest_log or latest_log.state != 'completed':
                    ProcessLog.objects.create(
                        sample=sample,
                        state='completed',
                        notes='Mycotoxin result(s) recorded and finalized.',
                        conducted_by=request.user.username or 'System',
                    )

            logger.info(
                'sample.mycotoxin_result.saved',
                extra={
                    'sample_id': sample.sample_id,
                    'toxin_type': result.toxin_type,
                    'value': result.value,
                    'risk_level': result.risk_level,
                },
            )
            if result.risk_level in {'high', 'critical'}:
                logger.warning(
                    'sample.high_risk_result',
                    extra={
                        'sample_id': sample.sample_id,
                        'toxin_type': result.toxin_type,
                        'value': result.value,
                        'risk_level': result.risk_level,
                    },
                )
            return Response(serializer.data, status=response_status)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_import_results(self, request):
        """Import mycotoxin results via Service Layer"""
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file is required (CSV).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = SampleIngestionService.process_csv_results(uploaded_file, request.user)
        except (ValueError, IntegrityError) as e:
            logger.error(
                'sample.bulk_import_results.failed',
                extra={'error': str(e), 'user': request.user.username},
            )
            return Response(
                {'detail': f'Import failed: {e}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception('sample.bulk_import_results.unexpected_error')
            return Response(
                {'detail': 'An unexpected error occurred during import processing.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info('sample.bulk_import_results.completed', extra={
            'matched_samples': results.get('samples', 0),
            'created_results': results.get('created', 0),
            'updated_results': results.get('updated', 0),
            'user': request.user.username,
        })
        payload = {
            'rows_processed': results.get('rows_processed', 0),
            'matched_samples': results.get('samples', 0),
            'results_created': results.get('created', 0),
            'results_updated': results.get('updated', 0),
            'skipped_rows': results.get('skipped_rows', 0),
            'unmatched_sample_ids': results.get('unmatched_sample_ids', []),
            'failed_rows': results.get('failed_rows', []),
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def request_upload(self, request):
        """
        Step 1: Request a presigned URL for the frontend to upload directly to S3.
        Body: { "filename": "sample.csv", "content_type": "text/csv" }
        Returns: { "upload_url": "...", "key": "mycotoxin-sample/{user}/{filename}" }
        """
        filename = request.data.get('filename', '').strip()
        content_type = request.data.get('content_type', 'application/octet-stream')
        if not filename:
            return Response({'detail': 'filename is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = generate_upload_url(
                username=request.user.username,
                filename=filename,
                content_type=content_type,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result)

    @action(detail=False, methods=['post'])
    def confirm_upload(self, request):
        """
        Step 2: Called after the frontend PUTs the file to S3 — enqueue a Celery task.
        Body: { "key": "mycotoxin-sample/{user}/{filename}" }
        Returns: { "task_id": "...", "status": "queued" }
        """
        key = request.data.get('key', '').strip()
        if not key:
            return Response({'detail': 'key is required'}, status=status.HTTP_400_BAD_REQUEST)

        task = process_sample_file.delay(key=key, uploaded_by_username=request.user.username)
        logger.info('sample.upload.confirmed', extra={'key': key, 'task_id': task.id, 'user': request.user.username})
        return Response({'task_id': task.id, 'status': 'queued'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], url_path='task_status/(?P<task_id>[^/.]+)')
    def task_status(self, request, task_id=None):
        """
        Poll Celery task status after confirm_upload
        GET /api/samples/task_status/{task_id}/
        Returns: { "status": "pending|started|success|failure", "result": {...} }
        """
        result = AsyncResult(task_id)
        response = {'task_id': task_id, 'status': result.status}
        if result.ready():
            if result.successful():
                response['result'] = result.get()
            else:
                response['error'] = str(result.result)
        return Response(response)

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        """Bulk delete samples - admin only"""
        if not (request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'):
            return Response(
                {'detail': 'You do not have permission to delete samples. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        sample_ids = request.data.get('sample_ids', [])
        if not isinstance(sample_ids, list) or not sample_ids:
            return Response(
                {'detail': 'sample_ids must be a non-empty list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(sample_ids) > BULK_DELETE_LIMIT:
            return Response(
                {'detail': f'Cannot delete more than {BULK_DELETE_LIMIT} samples at once.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        samples_qs = Sample.objects.filter(sample_id__in=sample_ids)
        found_ids = list(samples_qs.values_list('sample_id', flat=True))
        not_found = [sid for sid in sample_ids if sid not in found_ids]
        count = samples_qs.count()

        # Delete first so the operation succeeds even if audit logging fails
        samples_qs.delete()

        logger.warning(
            'sample.bulk_deleted',
            extra={
                'sample_ids': found_ids,
                'count': count,
                'deleted_by': request.user.username,
                'not_found': not_found,
            },
        )

        try:
            AuditLog.objects.create(
                actor=request.user,
                action='bulk_delete',
                model_name='Sample',
                object_id=','.join(found_ids),
                changes={
                    'count': count,
                    'sample_ids': found_ids,
                    'not_found': not_found,
                },
            )
        except Exception as audit_exc:
            logger.error('auditlog.write_failed', extra={'action': 'bulk_delete', 'error': str(audit_exc)})

        return Response({'deleted': count, 'not_found': not_found}, status=status.HTTP_200_OK)

    # ─── Dashboard Analytics V2 Endpoints ──────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='analytics/overview')
    def analytics_overview(self, request):
        """Dashboard Overview KPIs and Regional bounds."""
        data = AnalyticsService.get_overview(request.query_params)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='analytics/co-contamination')
    def analytics_co_contamination(self, request):
        """UpSet plot intersections and Network graph links."""
        data = AnalyticsService.get_co_contamination(request.query_params)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='analytics/threshold-simulation')
    def analytics_threshold_simulation(self, request):
        """Simulate overriding of toxin thresholds."""
        overrides = request.data.get('overrides', {})
        data = AnalyticsService.simulate_threshold(overrides, request.query_params)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='analytics/environmental-correlation')
    def analytics_environmental_correlation(self, request):
        """Stub for weather/moisture correlation chart."""
        data = AnalyticsService.get_environmental_correlation(request.query_params)
        return Response(data, status=status.HTTP_200_OK)
