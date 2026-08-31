import logging
import json

from celery.result import AsyncResult
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from rest_framework.decorators import action
from rest_framework import filters, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.exceptions import SampleAlreadyExists
from core.models import AuditLog
from core.permissions import IsAdmin, IsAdminOrResearchRole, IsOwnerOrAdmin

from .filters import apply_sample_filters
from .models import PredictionEstimate, ProcessLog, Sample
from .services.ingestion_service import SampleIngestionService
from .services.sample_service import SampleService
from .services.s3_service import generate_upload_url
from .services.test_data_service import TestDataService
from .serializers import (
    MycotoxinResultSerializer,
    PredictionBatchEstimateRequestSerializer,
    PredictionContextSerializer,
    PredictionEstimateSerializer,
    PredictionEstimateRequestSerializer,
    PredictionPublishRequestSerializer,
    ProcessLogSerializer,
    SampleCreateUpdateSerializer,
    SampleListSerializer,
    SampleSerializer,
)
from core.task_dispatcher import dispatch_task
from .tasks import process_sample_file
from .services.analytics_service import AnalyticsService
from .services.dashboard_payload_service import DashboardFilters, DashboardPayloadService
from .services.llm_summary_service import (
    LLMSummaryNotConfigured,
    LLMSummaryService,
    LLMSummaryServiceError,
)
from .services.nasa_power_service import NasaPowerService, NasaPowerServiceError
from .services.prediction_inference_service import (
    PredictionInferenceService,
    PredictionModelUnavailable,
)
from .services.prediction_model_publish_service import (
    PredictionModelPublishError,
    PredictionModelPublishService,
)
from .services.prediction_readiness_service import PredictionReadinessService

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
        .select_related('updated_by', 'recorded_by')
        .prefetch_related('process_logs', 'mycotoxin_results', 'prediction_estimates')
        .all()
    )
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sample_id', 'region', 'food_feed_type', 'sub_type']
    ordering_fields = ['collection_date', 'created_at', 'status']
    ordering = ['-collection_date']
    lookup_field = 'sample_id'

    def get_permissions(self):
        if self.action == 'prediction_publish':
            return [IsAuthenticated(), IsAdmin()]
        if self.action in [
            'analytics_dashboard_simulate',
            'analytics_threshold_simulation',
            'prediction_estimate',
            'prediction_batch_estimate',
            'prediction_estimate_sample',
            'prediction_context',
            'prediction_history',
            'prediction_readiness',
            'prediction_status',
        ]:
            return [IsAuthenticated(), IsAdminOrResearchRole()]
        if self.action in ['destroy', 'bulk_delete', 'generate_test_data', 'delete_test_data']:
            return [IsAuthenticated(), IsAdmin()]
        return [permission() for permission in self.permission_classes]

    def get_serializer_class(self):
        if self.action == 'list':
            return SampleListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return SampleCreateUpdateSerializer
        return SampleSerializer

    def get_queryset(self):
        return apply_sample_filters(super().get_queryset(), self.request.query_params)

    def perform_create(self, serializer):
        sample = serializer.save(
            updated_by=self.request.user,
            recorded_by=self.request.user,
            # Kept for ownership compatibility while old records exist.
            collected_by=self.request.user.username,
        )
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
        """Get dashboard statistics - filtered by user role"""
        queryset = Sample.objects.all()

        # Apply role-based filtering
        if request.user.role not in ["admin", "head_researcher", "researcher"]:
            # research_assistant and other roles see only their own samples
            queryset = queryset.filter(
                updated_by=request.user
            ) | queryset.filter(
                collected_by=request.user.username
            )

        stats = queryset.aggregate(
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
        """Get recently flagged samples - filtered by user role"""
        queryset = Sample.objects.filter(status='flagged')

        # Apply role-based filtering
        if request.user.role not in ["admin", "head_researcher", "researcher"]:
            # research_assistant and other roles see only their own samples
            queryset = queryset.filter(
                updated_by=request.user
            ) | queryset.filter(
                collected_by=request.user.username
            )

        recent = queryset.order_by('-updated_at')[:RECENT_ALERTS_LIMIT]
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

                # If results are recorded, mark the sample workflow as completed if pending/in_progress.
                # Preserve 'flagged' status so active risk investigations remain flagged.
                if sample.status in ('pending', 'in_progress'):
                    sample.status = 'completed'
                    sample.updated_by = request.user
                    sample.save(update_fields=['status', 'updated_by', 'updated_at'])

                latest_log = sample.process_logs.order_by('-timestamp').first()
                if sample.status == 'completed' and (not latest_log or latest_log.state != 'completed'):
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
    def bulk_import_dashboard(self, request):
        """Import the supplied dashboard CSV, creating samples then upserting results by ID."""
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({'detail': 'file is required (CSV).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = SampleIngestionService.process_csv_results(
                uploaded_file, request.user, create_missing_samples=True,
            )
        except (ValueError, IntegrityError) as exc:
            return Response({'detail': f'Import failed: {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            logger.exception('sample.bulk_import_dashboard.unexpected_error')
            return Response(
                {'detail': 'An unexpected error occurred during dashboard import.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'rows_processed': results.get('rows_processed', 0),
            'samples_created': results.get('created_samples', 0),
            'matched_samples': results.get('samples', 0),
            'results_created': results.get('created', 0),
            'results_updated': results.get('updated', 0),
            'skipped_rows': results.get('skipped_rows', 0),
            'failed_rows': results.get('failed_rows', []),
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def export_failed_rows(self, request):
        """
        Accepts a list of failed_rows (including row_data) and returns a CSV file response.
        Useful for immediately downloading an error report after a bulk import.
        """
        failed_rows = request.data.get('failed_rows', [])
        if not failed_rows:
            return Response({'detail': 'No failed rows provided.'}, status=status.HTTP_400_BAD_REQUEST)

        csv_content = SampleIngestionService.generate_failed_rows_csv(failed_rows)

        from django.http import HttpResponse
        response = HttpResponse(csv_content, content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="failed_import_rows.csv"'
        return response

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
        Step 2: Called after the frontend PUTs the file to S3 — enqueue a Celery task or dispatch directly.
        Body: { "key": "mycotoxin-sample/{user}/{filename}" }
        Returns: { "task_id": "...", "status": "queued|success|failure" }
        """
        key = request.data.get('key', '').strip()
        if not key:
            return Response({'detail': 'key is required'}, status=status.HTTP_400_BAD_REQUEST)

        task = dispatch_task(process_sample_file, kwargs={'key': key, 'uploaded_by_username': request.user.username})
        logger.info('sample.upload.confirmed', extra={'key': key, 'task_id': task.id, 'user': request.user.username})

        # If the task completed synchronously, we can adjust the response status.
        if getattr(task, 'status', None) in ['success', 'failed', 'partial']:
            return Response({'task_id': task.id, 'status': task.status}, status=status.HTTP_200_OK)

        return Response({'task_id': task.id, 'status': 'queued'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['get'], url_path='task_status/(?P<task_id>[^/.]+)')
    def task_status(self, request, task_id=None):
        """
        Poll Celery task status after confirm_upload.
        Restricted to authenticated users who own the task.
        GET /api/samples/task_status/{task_id}/
        Returns: { "status": "pending|started|success|failure", "result": {...} }
        """
        result = AsyncResult(task_id)

        # Verify the task belongs to the requesting user
        if result.status not in ['PENDING'] and result.info:
            # Check if task metadata contains user info
            task_user = None
            if isinstance(result.info, dict):
                task_user = result.info.get('uploaded_by_username')

            if task_user and task_user != request.user.username:
                return Response(
                    {'detail': 'You do not have permission to view this task.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

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
                object_id='(multiple)',
                changes={
                    'count': count,
                    'sample_ids': found_ids,
                    'not_found': not_found,
                },
            )
        except Exception as audit_exc:
            logger.error('auditlog.write_failed', extra={'action': 'bulk_delete', 'error': str(audit_exc)})

        return Response({'deleted': count, 'not_found': not_found}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def generate_test_data(self, request):
        """Generate test samples - admin only"""
        seed = request.data.get('seed', 42)
        as_of_str = request.data.get('as_of')
        as_of_date = None
        if as_of_str:
            try:
                from datetime import datetime
                as_of_date = datetime.strptime(as_of_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'detail': f"Invalid date format for as_of: '{as_of_str}'. Use YYYY-MM-DD."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        result = TestDataService.generate_test_samples(
            user=request.user,
            seed=seed,
            as_of=as_of_date,
        )

        try:
            AuditLog.objects.create(
                actor=request.user,
                action='generate_test_data',
                model_name='Sample',
                object_id='(multiple)',
                changes=result,
            )
        except Exception as audit_exc:
            logger.error('auditlog.write_failed', extra={'action': 'generate_test_data', 'error': str(audit_exc)})

        return Response(result, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def delete_test_data(self, request):
        """Cleanup all TEST-prefixed samples - admin only"""
        result = TestDataService.delete_test_samples(user=request.user)

        try:
            AuditLog.objects.create(
                actor=request.user,
                action='delete_test_data',
                model_name='Sample',
                object_id='(multiple)',
                changes=result,
            )
        except Exception as audit_exc:
            logger.error('auditlog.write_failed', extra={'action': 'delete_test_data', 'error': str(audit_exc)})

        return Response(result, status=status.HTTP_200_OK)

    # ─── Dashboard Analytics V2 Endpoints ──────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='analytics/dashboard')
    def analytics_dashboard(self, request):
        """Return the canonical aggregate dashboard contract."""
        sections = DashboardPayloadService.build(
            filters=DashboardFilters.from_mapping(request.query_params),
            include_external=False,
        )
        return Response({'schema_version': 1, 'sections': sections}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='analytics/dashboard/simulate')
    def analytics_dashboard_simulate(self, request):
        """Return canonical aggregates using authenticated threshold overrides."""
        filters_payload = request.data.get('filters', {})
        overrides = request.data.get('threshold_overrides', request.data.get('overrides', {}))
        try:
            # Reuse validation and canonical threshold behavior from AnalyticsService.
            AnalyticsService.validate_threshold_overrides(overrides)
            sections = DashboardPayloadService.build(
                filters=DashboardFilters.from_mapping(filters_payload),
                threshold_overrides=overrides,
                include_external=False,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'schema_version': 1, 'sections': sections}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='analytics/overview')
    def analytics_overview(self, request):
        """Deprecated: use analytics/dashboard."""
        data = AnalyticsService.get_overview(request.query_params)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='analytics/co-contamination')
    def analytics_co_contamination(self, request):
        """Deprecated: use analytics/dashboard."""
        data = AnalyticsService.get_co_contamination(request.query_params)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='analytics/threshold-simulation')
    def analytics_threshold_simulation(self, request):
        """Deprecated: use analytics/dashboard/simulate."""
        overrides = request.data.get('overrides', {})
        try:
            data = AnalyticsService.simulate_threshold(overrides, request.query_params)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='analytics/environmental-correlation')
    def analytics_environmental_correlation(self, request):
        """NASA POWER weather and soil kinetics for the dashboard filter context."""
        try:
            data = NasaPowerService.get_environmental_correlation(request.query_params)
        except NasaPowerServiceError as exc:
            logger.warning(
                'environmental_correlation.nasa_power_failed',
                extra={'error': str(exc), 'user': request.user.username},
            )
            return Response(
                {
                    'source': 'NASA POWER',
                    'data': [],
                    'requires_nasa_power': True,
                    'message': 'NASA POWER environmental data is temporarily unavailable.',
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='prediction/readiness')
    def prediction_readiness(self, request):
        """Return the labelled-data checks required before training a model."""
        return Response(PredictionReadinessService.get_readiness(), status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='prediction/status')
    def prediction_status(self, request):
        """Return prediction model versions, publish state, and metrics."""
        return Response(PredictionInferenceService.get_model_status(), status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='prediction/publish')
    def prediction_publish(self, request):
        """Publish reviewed prediction toxin models. Admin-only."""
        serializer = PredictionPublishRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            publish_result = PredictionModelPublishService.publish(
                version=serializer.validated_data['version'],
                toxins=serializer.validated_data['toxins'],
                min_f1=serializer.validated_data['min_f1'],
                min_roc_auc=serializer.validated_data['min_roc_auc'],
                force=serializer.validated_data['force'],
            )
        except PredictionModelPublishError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                **publish_result,
                'status': PredictionInferenceService.get_model_status(),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], url_path='prediction/estimate')
    def prediction_estimate(self, request):
        """Estimate toxin detection risk from the latest trained baseline artifacts."""
        serializer = PredictionEstimateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            data = PredictionInferenceService.estimate(serializer.validated_data)
        except PredictionModelUnavailable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        self.record_prediction_estimate(
            sample=None,
            user=request.user,
            payload=serializer.validated_data,
            result=data,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='prediction/batch-estimate')
    def prediction_batch_estimate(self, request):
        """Estimate toxin detection risk for multiple registered samples."""
        serializer = PredictionBatchEstimateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sample_ids = serializer.validated_data['sample_ids']
        samples = (
            Sample.objects
            .select_related('recorded_by', 'updated_by', 'prediction_context')
            .filter(sample_id__in=sample_ids)
        )
        sample_map = {sample.sample_id: sample for sample in samples}
        results = []
        errors = []

        for sample_id in sample_ids:
            sample = sample_map.get(sample_id)
            if sample is None:
                errors.append({'sampleId': sample_id, 'detail': 'Sample not found.'})
                continue

            payload = PredictionInferenceService.sample_to_payload(sample)
            try:
                estimate = PredictionInferenceService.estimate(payload)
            except PredictionModelUnavailable as exc:
                if not results:
                    return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                errors.append({'sampleId': sample_id, 'detail': str(exc)})
                continue

            self.record_prediction_estimate(
                sample=sample,
                user=request.user,
                payload=payload,
                result=estimate,
            )
            results.append({'sampleId': sample_id, 'estimate': estimate})

        return Response(
            {
                'requested': len(sample_ids),
                'completed': len(results),
                'failed': len(errors),
                'results': results,
                'errors': errors,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='prediction/estimate')
    def prediction_estimate_sample(self, request, sample_id=None):
        """Estimate toxin detection risk using a registered sample's context fields."""
        sample = self.get_object()
        try:
            payload = PredictionInferenceService.sample_to_payload(sample)
            data = PredictionInferenceService.estimate(payload)
        except PredictionModelUnavailable as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        self.record_prediction_estimate(
            sample=sample,
            user=request.user,
            payload=payload,
            result=data,
        )
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='prediction/history')
    def prediction_history(self, request, sample_id=None):
        """Return recent prediction estimates for a registered sample."""
        sample = self.get_object()
        try:
            requested_limit = int(request.query_params.get('limit', 10))
        except (TypeError, ValueError):
            requested_limit = 10
        limit = min(max(requested_limit, 1), 50)
        estimates = (
            PredictionEstimate.objects
            .select_related('sample', 'requested_by')
            .filter(sample=sample)
            .order_by('-created_at')[:limit]
        )
        return Response(PredictionEstimateSerializer(estimates, many=True).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'put', 'patch'], url_path='prediction/context')
    def prediction_context(self, request, sample_id=None):
        """Read or update optional predictor fields for a registered sample."""
        sample = self.get_object()
        context = getattr(sample, 'prediction_context', None)
        if request.method == 'GET':
            if context is None:
                return Response({}, status=status.HTTP_200_OK)
            return Response(PredictionContextSerializer(context).data, status=status.HTTP_200_OK)

        serializer = PredictionContextSerializer(
            context,
            data=request.data,
            partial=request.method == 'PATCH',
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(sample=sample)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @staticmethod
    def record_prediction_estimate(*, sample, user, payload: dict, result: dict) -> PredictionEstimate:
        def json_safe(value):
            return json.loads(json.dumps(value, default=str))

        return PredictionEstimate.objects.create(
            sample=sample,
            requested_by=user,
            model_version=result.get('modelVersion', ''),
            model_family=result.get('modelFamily', ''),
            uses_weather_features=result.get('usesWeatherFeatures', False),
            input_payload=json_safe(payload),
            predictions_payload=json_safe(result.get('predictions', [])),
            warning=result.get('warning', ''),
        )

    @action(detail=False, methods=['post'], url_path='analytics/public-health-summary')
    def analytics_public_health_summary(self, request):
        """Generate LLM public health risk drivers from aggregate dashboard context."""
        try:
            data = LLMSummaryService.generate_public_health_summary(request.data)
        except LLMSummaryNotConfigured:
            return Response(
                {'detail': 'LLM summary provider is not configured.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except LLMSummaryServiceError as exc:
            logger.warning(
                'public_health_summary.generation_failed',
                extra={'error': str(exc), 'user': request.user.username},
            )
            return Response(
                {'detail': 'Unable to generate LLM public health summary.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(data, status=status.HTTP_200_OK)
