import torch
import torch.nn as nn
import torch.nn.functional as F
from monai.networks.nets import UNet
from monai.networks.layers import Norm
import numpy as np
from PIL import Image
import cv2
from typing import Tuple, Optional
import pydicom
import nibabel as nib
import os

class MedicalImageAnalyzer:
    """Main AI model for medical image analysis"""
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = None
        self.load_model()
    
    def load_model(self):
        """Load pretrained segmentation model"""
        # Using MONAI UNet for 2D/3D segmentation
        self.model = UNet(
            spatial_dims=2,
            in_channels=1,
            out_channels=2,
            channels=(16, 32, 64, 128, 256),
            strides=(2, 2, 2, 2),
            num_res_units=2,
            norm=Norm.BATCH,
        ).to(self.device)
        
        # Load pretrained weights (would be from actual training)
        # For demo, using random weights
        self.model.eval()
    
    def preprocess_dicom(self, file_path: str) -> np.ndarray:
        """Preprocess DICOM file for model input"""
        try:
            ds = pydicom.dcmread(file_path)
            image = ds.pixel_array.astype(np.float32)
            
            # Normalize
            image = (image - image.min()) / (image.max() - image.min() + 1e-8)
            
            # Resize if needed
            if image.shape != (512, 512):
                image = cv2.resize(image, (512, 512))
            
            # Add channel dimension
            image = np.expand_dims(image, axis=0)
            image = np.expand_dims(image, axis=0)  # Add batch dimension
            
            return image
        except Exception as e:
            raise ValueError(f"Error processing DICOM: {str(e)}")
    
    def preprocess_nifti(self, file_path: str) -> np.ndarray:
        """Preprocess NIfTI file for 3D model"""
        img = nib.load(file_path)
        data = img.get_fdata().astype(np.float32)
        
        # Normalize
        data = (data - data.min()) / (data.max() - data.min() + 1e-8)
        
        # Extract middle slices for 2D processing
        middle_slice = data[:, :, data.shape[2] // 2]
        
        # Resize
        if middle_slice.shape != (512, 512):
            middle_slice = cv2.resize(middle_slice, (512, 512))
        
        # Add dimensions
        middle_slice = np.expand_dims(middle_slice, axis=0)
        middle_slice = np.expand_dims(middle_slice, axis=0)
        
        return middle_slice
    
    def preprocess_image(self, file_path: str) -> np.ndarray:
        """Preprocess standard image file"""
        image = Image.open(file_path).convert('L')
        image = np.array(image, dtype=np.float32)
        
        # Normalize
        image = (image - image.min()) / (image.max() - image.min() + 1e-8)
        
        # Resize
        if image.shape != (512, 512):
            image = cv2.resize(image, (512, 512))
        
        # Add dimensions
        image = np.expand_dims(image, axis=0)
        image = np.expand_dims(image, axis=0)
        
        return image
    
    def predict(self, file_path: str, scan_type: str) -> Tuple[np.ndarray, float, np.ndarray]:
        """Main prediction pipeline"""
        try:
            # Preprocess based on file type
            if scan_type in ['MRI', 'CT']:
                if file_path.lower().endswith('.dcm'):
                    image = self.preprocess_dicom(file_path)
                elif file_path.lower().endswith(('.nii', '.nii.gz')):
                    image = self.preprocess_nifti(file_path)
                else:
                    image = self.preprocess_image(file_path)
            else:
                image = self.preprocess_image(file_path)
            
            # Convert to tensor
            image_tensor = torch.from_numpy(image).to(self.device)
            
            # Inference
            with torch.no_grad():
                output = self.model(image_tensor)
                probabilities = F.softmax(output, dim=1)
                segmentation = torch.argmax(probabilities, dim=1)
            
            # Extract mask
            mask = segmentation.cpu().numpy().squeeze()
            
            # Calculate confidence (using probability of detected region)
            max_prob = probabilities.cpu().numpy().max()
            confidence = float(max_prob)
            
            # Create overlay
            original = image.squeeze()
            overlay = self.create_overlay(original, mask)
            
            # Detect anomalies
            anomalies_found = bool(mask.max() > 0)
            anomaly_details = self.get_anomaly_details(mask, original, confidence)
            
            return mask, confidence, overlay, anomalies_found, anomaly_details
            
        except Exception as e:
            raise RuntimeError(f"Prediction failed: {str(e)}")
    
    def create_overlay(self, original: np.ndarray, mask: np.ndarray) -> np.ndarray:
        """Create heatmap overlay for visualization"""
        # Normalize original
        if original.max() > 1.0:
            original = original / 255.0
        
        # Create colored mask
        colored_mask = np.zeros((*mask.shape, 3), dtype=np.float32)
        colored_mask[mask > 0] = [1.0, 0.0, 0.0]  # Red for anomalies
        
        # Blend
        alpha = 0.3
        overlay = original.copy()
        if len(overlay.shape) == 2:
            overlay = np.stack([overlay] * 3, axis=-1)
        
        overlay = overlay * (1 - alpha) + colored_mask * alpha
        overlay = np.clip(overlay, 0, 1)
        
        return (overlay * 255).astype(np.uint8)
    
    def get_anomaly_details(self, mask: np.ndarray, original: np.ndarray, confidence: float) -> dict:
        """Extract detailed information about anomalies"""
        if mask.max() == 0:
            return {'detected': False}
        
        # Find connected components
        num_labels, labels = cv2.connectedComponents(mask.astype(np.uint8))
        
        anomalies = []
        for label in range(1, num_labels):
            positions = np.where(labels == label)
            if len(positions[0]) > 0:
                # Bounding box
                x_min, x_max = positions[1].min(), positions[1].max()
                y_min, y_max = positions[0].min(), positions[0].max()
                
                # Area
                area = len(positions[0])
                
                anomalies.append({
                    'bbox': [int(x_min), int(y_min), int(x_max), int(y_max)],
                    'area': int(area),
                    'confidence': confidence,
                })
        
        return {
            'detected': True,
            'num_anomalies': len(anomalies),
            'anomalies': anomalies,
            'total_confidence': confidence,
        }

# Singleton instance
analyzer = MedicalImageAnalyzer()