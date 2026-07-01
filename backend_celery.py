from celery import shared_task
from django.core.files.base import ContentFile
import boto3
from django.conf import settings
from .models import MedicalScan, ScanHistory
from ml.model import analyzer
import tempfile
import os
from datetime import datetime
import numpy as np
from io import BytesIO
from PIL import Image

@shared_task
def process_medical_scan(scan_id):
    """Process medical scan with AI model"""
    from .models import MedicalScan
    
    try:
        scan = MedicalScan.objects.get(id=scan_id)
        scan.status = 'PROCESSING'
        scan.processing_started_at = datetime.now()
        scan.save()
        
        # Download file from S3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME
        )
        
        # Get file from URL
        file_url = scan.original_file
        file_key = file_url.replace(f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/", "")
        
        # Download to temp file
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            s3_client.download_fileobj(
                settings.AWS_STORAGE_BUCKET_NAME,
                file_key,
                temp_file
            )
            temp_path = temp_file.name
        
        try:
            # Run AI prediction
            mask, confidence, overlay, anomalies_found, anomaly_details = analyzer.predict(
                temp_path,
                scan.scan_type
            )
            
            # Save results
            scan.confidence_score = confidence
            scan.anomalies_found = anomalies_found
            scan.anomaly_details = anomaly_details
            
            # Upload processed files
            # Segmentation mask
            mask_pil = Image.fromarray((mask * 255).astype(np.uint8))
            mask_buffer = BytesIO()
            mask_pil.save(mask_buffer, format='PNG')
            mask_buffer.seek(0)
            
            mask_key = f"processed/{scan.user.id}/{scan.id}/mask.png"
            s3_client.upload_fileobj(
                mask_buffer,
                settings.AWS_STORAGE_BUCKET_NAME,
                mask_key,
                ExtraArgs={'ContentType': 'image/png'}
            )
            scan.segmentation_mask = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{mask_key}"
            
            # Overlay
            overlay_pil = Image.fromarray(overlay)
            overlay_buffer = BytesIO()
            overlay_pil.save(overlay_buffer, format='PNG')
            overlay_buffer.seek(0)
            
            overlay_key = f"processed/{scan.user.id}/{scan.id}/overlay.png"
            s3_client.upload_fileobj(
                overlay_buffer,
                settings.AWS_STORAGE_BUCKET_NAME,
                overlay_key,
                ExtraArgs={'ContentType': 'image/png'}
            )
            scan.processed_file = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{overlay_key}"
            
            scan.status = 'COMPLETED'
            scan.processing_completed_at = datetime.now()
            scan.save()
            
            ScanHistory.objects.create(
                scan=scan,
                action='PROCESSED',
                details={
                    'confidence': confidence,
                    'anomalies_found': anomalies_found,
                    'num_anomalies': anomaly_details.get('num_anomalies', 0)
                }
            )
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        scan.status = 'FAILED'
        scan.save()
        
        ScanHistory.objects.create(
            scan=scan,
            action='FAILED',
            details={'error': str(e)}
        )
        raise e
    
    return scan_id