from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from .models import MedicalScan, ScanHistory
from .serializers import (
    MedicalScanSerializer, ScanUploadSerializer,
    ScanResultSerializer, UserSerializer, ScanHistorySerializer
)
from .tasks import process_medical_scan
import boto3
from django.conf import settings
import os
from datetime import datetime
import uuid

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return self.queryset.filter(id=self.request.user.id)

class MedicalScanViewSet(viewsets.ModelViewSet):
    serializer_class = MedicalScanSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return MedicalScan.objects.filter(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        serializer = ScanUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        file = serializer.validated_data['file']
        scan_type = serializer.validated_data['scan_type']
        
        # Upload to S3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        
        file_key = f"scans/{request.user.id}/{uuid.uuid4()}/{file.name}"
        s3_client.upload_fileobj(
            file,
            settings.AWS_STORAGE_BUCKET_NAME,
            file_key,
            ExtraArgs={'ContentType': file.content_type}
        )
        
        file_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{file_key}"
        
        # Create scan record
        scan = MedicalScan.objects.create(
            user=request.user,
            scan_type=scan_type,
            original_file=file_url,
            patient_id=serializer.validated_data.get('patient_id', ''),
            study_description=serializer.validated_data.get('study_description', ''),
            status='PENDING'
        )
        
        # Trigger async processing
        process_medical_scan.delay(str(scan.id))
        
        # Log history
        ScanHistory.objects.create(
            scan=scan,
            action='UPLOAD',
            details={'file_name': file.name, 'scan_type': scan_type}
        )
        
        return Response(
            MedicalScanSerializer(scan, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['get'])
    def result(self, request, pk=None):
        scan = self.get_object()
        serializer = ScanResultSerializer(scan)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        scan = self.get_object()
        history = scan.history.all()
        serializer = ScanHistorySerializer(history, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        scan = self.get_object()
        scan.status = 'PENDING'
        scan.save()
        
        process_medical_scan.delay(str(scan.id))
        
        ScanHistory.objects.create(
            scan=scan,
            action='REPROCESS',
            details={'requested_by': request.user.username}
        )
        
        return Response({'status': 'processing started'})