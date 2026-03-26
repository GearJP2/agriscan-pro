import logging
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
            sample = Sample.objects.create(**validated_item, updated_by=request.user)
            samples.append(sample)
            
            # Create initial process log
            ProcessLog.objects.create(
                sample=sample,
                state='registered',
                notes=f'Bulk imported - {len(data)} samples',
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
            logger.info('sample.mycotoxin_result.added', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'dangerous': result.dangerous})
            if result.dangerous:
                logger.warning('sample.dangerous_result', extra={'sample_id': sample.sample_id, 'test_method': result.test_method, 'intensity': result.intensity})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

