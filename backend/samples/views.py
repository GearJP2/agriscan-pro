import logging
from django.db import IntegrityError
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from .models import Sample, ProcessLog, MycotoxinResult
from .serializers import (
    SampleSerializer,
    SampleListSerializer,
    SampleCreateUpdateSerializer,
    ProcessLogSerializer,
    MycotoxinResultSerializer,
)
from core.exceptions import SampleAlreadyExists
from .services.s3_service import generate_upload_url
from .tasks import process_sample_file

logger = logging.getLogger('agriscan.samples')


class SampleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing samples.
    Provides CRUD operations and filtering capabilities.
    """
    queryset = Sample.objects.prefetch_related('process_logs', 'mycotoxin_results').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sample_id', 'region', 'vegetation_variety']
    ordering_fields = ['collection_date', 'created_at', 'status']
    ordering = ['-collection_date']
    lookup_field = 'sample_id'

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
        
        return queryset

    def perform_create(self, serializer):
        sample = serializer.save(updated_by=self.request.user)
        logger.info('sample.created', extra={'sample_id': sample.sample_id, 'user': self.request.user.username})
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
        logger.info('sample.updated', extra={'sample_id': sample.sample_id, 'user': self.request.user.username})

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or getattr(request.user, 'role', None) == 'admin'):
            return Response(
                {'detail': 'You do not have permission to delete samples. Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
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
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get dashboard statistics"""
        total_samples = Sample.objects.count()
        completed_samples = Sample.objects.filter(status='completed').count()
        flagged_samples = Sample.objects.filter(status='flagged').count()
        pending_samples = Sample.objects.filter(status='pending').count()
        
        high_risk = Sample.objects.filter(
            mycotoxin_results__dangerous=True
        ).distinct().count()
        
        return Response({
            'total_samples': total_samples,
            'completed': completed_samples,
            'flagged': flagged_samples,
            'pending': pending_samples,
            'high_risk': high_risk,
        })

    @action(detail=False, methods=['get'])
    def recent_alerts(self, request):
        """Get recently flagged samples"""
        recent = Sample.objects.filter(
            status='flagged'
        ).order_by('-updated_at')[:10]
        serializer = SampleListSerializer(recent, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_process_log(self, request, sample_id=None):
        """Add a process log entry to a sample"""
        sample = self.get_object()
        serializer = ProcessLogSerializer(data=request.data)
        if serializer.is_valid():
            process_log = serializer.save(sample=sample)
            logger.info('sample.process_log.added', extra={'sample_id': sample.sample_id, 'state': process_log.state})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Bulk create samples"""
        data = request.data if isinstance(request.data, list) else [request.data]

        # Check for existing sample_ids before validation (returns 409 instead of 400)
        incoming_ids = [item.get('sample_id') for item in data if isinstance(item, dict) and item.get('sample_id')]
        if incoming_ids:
            existing = list(Sample.objects.filter(sample_id__in=incoming_ids).values_list('sample_id', flat=True))
            if existing:
                raise SampleAlreadyExists(detail=f"Sample ID(s) already exist: {', '.join(existing)}")

        serializer = SampleCreateUpdateSerializer(data=data, many=True)
        if not serializer.is_valid():
            logger.error('sample.bulk_create.validation_error', extra={'error_count': len(serializer.errors), 'user': self.request.user.username})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        samples = []
        for validated_item in serializer.validated_data:
            # Create sample using the serializer's create method to apply defaults
            # Set defaults for empty/null fields
            if not validated_item.get('purpose'):
                validated_item['purpose'] = 'routine'
            if not validated_item.get('sample_type'):
                validated_item['sample_type'] = 'field'
            if not validated_item.get('processing_type'):
                validated_item['processing_type'] = 'raw'
            if not validated_item.get('collected_by'):
                validated_item['collected_by'] = 'Imported'
            if not validated_item.get('additional_info'):
                validated_item['additional_info'] = ''
            
            # Create sample with updated_by field
            try:
                sample = Sample.objects.create(**validated_item, updated_by=request.user)
            except IntegrityError:
                raise SampleAlreadyExists(detail=f"Sample ID '{validated_item.get('sample_id')}' already exists.")
            samples.append(sample)

            # Create initial process log based on imported status.
            initial_state = 'completed' if sample.status == 'completed' else 'registered'
            initial_note = (
                'Bulk imported with recorded results.'
                if initial_state == 'completed'
                else f'Bulk imported - {len(data)} samples'
            )
            ProcessLog.objects.create(
                sample=sample,
                state=initial_state,
                notes=initial_note,
                conducted_by=request.user.username or 'System'
            )

        logger.info('sample.bulk_created', extra={'count': len(samples), 'user': self.request.user.username})
        return Response(SampleSerializer(samples, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_mycotoxin_result(self, request, sample_id=None):
        """Add a mycotoxin test result to a sample"""
        sample = self.get_object()
        serializer = MycotoxinResultSerializer(data=request.data)
        if serializer.is_valid():
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

            logger.info('sample.mycotoxin_result.added', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'dangerous': result.dangerous})
            if result.dangerous:
                logger.warning('sample.dangerous_result', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'intensity': result.intensity})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def request_upload(self, request):
        """
        Step 1: Frontend ขอ presigned URL ก่อน upload
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
        Step 2: Frontend เรียกหลัง PUT ไฟล์ขึ้น S3 สำเร็จ — enqueue Celery task
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
        from celery.result import AsyncResult
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
        if len(sample_ids) > 500:
            return Response(
                {'detail': 'Cannot delete more than 500 samples at once.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        samples_qs = Sample.objects.filter(sample_id__in=sample_ids)
        found_ids = list(samples_qs.values_list('sample_id', flat=True))
        not_found = [sid for sid in sample_ids if sid not in found_ids]
        count = samples_qs.count()
        logger.warning(
            'sample.bulk_deleted',
            extra={
                'sample_ids': found_ids,
                'count': count,
                'deleted_by': request.user.username,
                'not_found': not_found,
            },
        )
        samples_qs.delete()
        return Response({'deleted': count, 'not_found': not_found}, status=status.HTTP_200_OK)

