from django.db import models
from django.contrib.auth.models import User
import uuid
from django.utils import timezone

class MedicalScan(models.Model):
    SCAN_TYPES = [
        ('MRI', 'MRI'),
        ('CT', 'CT Scan'),
        ('XRAY', 'X-Ray'),
        ('PET', 'PET Scan'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending Processing'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scans')
    scan_type = models.CharField(max_length=10, choices=SCAN_TYPES)
    
    # File storage
    original_file = models.URLField(max_length=500)
    processed_file = models.URLField(max_length=500, null=True, blank=True)
    segmentation_mask = models.URLField(max_length=500, null=True, blank=True)
    
    # Metadata
    patient_id = models.CharField(max_length=50, blank=True)
    study_description = models.TextField(blank=True)
    series_description = models.TextField(blank=True)
    scan_date = models.DateTimeField(null=True, blank=True)
    
    # Results
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    confidence_score = models.FloatField(null=True, blank=True)
    anomalies_found = models.BooleanField(default=False)
    anomaly_details = models.JSONField(default=dict, blank=True)
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.scan_type} - {self.user.username} - {self.created_at}"

class ScanHistory(models.Model):
    scan = models.ForeignKey(MedicalScan, on_delete=models.CASCADE, related_name='history')
    action = models.CharField(max_length=50)
    details = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']