from rest_framework import serializers
from django.contrib.auth.models import User
from .models import MedicalScan, ScanHistory

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']

class MedicalScanSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = MedicalScan
        fields = [
            'id', 'user', 'scan_type', 'original_file', 'processed_file',
            'segmentation_mask', 'patient_id', 'study_description',
            'series_description', 'scan_date', 'status', 'confidence_score',
            'anomalies_found', 'anomaly_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'status', 'created_at', 'updated_at']

class ScanUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    scan_type = serializers.ChoiceField(choices=['MRI', 'CT', 'XRAY', 'PET'])
    patient_id = serializers.CharField(required=False, allow_blank=True)
    study_description = serializers.CharField(required=False, allow_blank=True)
    
    def validate_file(self, value):
        max_size = 100 * 1024 * 1024  # 100MB
        if value.size > max_size:
            raise serializers.ValidationError(f"File too large. Max size: {max_size} bytes")
        return value

class ScanResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalScan
        fields = [
            'id', 'status', 'confidence_score', 'anomalies_found',
            'anomaly_details', 'processed_file', 'segmentation_mask'
        ]

class ScanHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ScanHistory
        fields = ['action', 'details', 'timestamp']