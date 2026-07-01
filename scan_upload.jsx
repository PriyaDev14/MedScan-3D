import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export const ScanUpload = () => {
  const [file, setFile] = useState(null);
  const [scanType, setScanType] = useState('MRI');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const { token } = useAuth();

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      // Validate file size (100MB max)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 100MB');
        return;
      }
      
      // Validate file type
      const validTypes = ['.dcm', '.nii', '.nii.gz', '.png', '.jpg', '.jpeg'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.'));
      if (!validTypes.includes(fileExtension)) {
        toast.error('Invalid file type. Supported: DICOM, NIfTI, PNG, JPG');
        return;
      }
      
      setFile(file);
      toast.success('File uploaded successfully');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.dcm', '.nii', '.nii.gz'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
    maxFiles: 1,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('scan_type', scanType);

    try {
      const response = await api.uploadScan(formData, token, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
        setProgress(progress);
      });

      toast.success('Scan uploaded successfully! Processing...');
      
      // Navigate to scan viewer with polling for results
      navigate(`/scan/${response.data.id}`, { 
        state: { 
          scanId: response.data.id,
          processing: true 
        } 
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(error.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const removeFile = () => {
    setFile(null);
    toast.success('File removed');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-lg p-8"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Medical Scan</h2>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${file ? 'bg-green-50 border-green-500' : ''}`}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="flex items-center justify-center space-x-3">
              <FileText className="w-8 h-8 text-green-500" />
              <span className="text-gray-700">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {isDragActive
                  ? 'Drop your file here...'
                  : 'Drag & drop your medical scan here, or click to select'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported: DICOM (.dcm), NIfTI (.nii, .nii.gz), PNG, JPG
              </p>
            </>
          )}
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scan Type
          </label>
          <select
            value={scanType}
            onChange={(e) => setScanType(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="MRI">MRI</option>
            <option value="CT">CT Scan</option>
            <option value="XRAY">X-Ray</option>
            <option value="PET">PET Scan</option>
          </select>
        </div>

        {isUploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Uploading...</span>
              <span className="text-sm font-medium text-blue-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || isUploading}
          className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-colors
            ${!file || isUploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isUploading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Processing...
            </span>
          ) : (
            'Upload & Analyze'
          )}
        </button>
      </motion.div>
    </div>
  );
};