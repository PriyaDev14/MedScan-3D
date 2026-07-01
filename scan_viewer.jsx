import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import ThreeDViewer from '../components/ThreeDViewer';
import toast from 'react-hot-toast';

export const ScanViewer = () => {
  const { id } = useParams();
  const location = useLocation();
  const { token } = useAuth();
  const [scan, setScan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlice, setCurrentSlice] = useState(0);
  const [slices, setSlices] = useState([]);
  const [isProcessing, setIsProcessing] = useState(location.state?.processing || false);
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    fetchScanData();
    
    if (isProcessing) {
      // Poll for results every 2 seconds
      const interval = setInterval(() => {
        fetchScanData();
      }, 2000);
      setPollInterval(interval);
      
      return () => clearInterval(interval);
    }
  }, [id]);

  const fetchScanData = async () => {
    try {
      const response = await api.getScan(id, token);
      const data = response.data;
      setScan(data);
      
      // Extract slices from processed data if available
      if (data.processed_file && data.segmentation_mask) {
        setSlices(generateSlices(data));
      }
      
      if (data.status === 'COMPLETED') {
        setIsProcessing(false);
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        toast.success('Analysis completed!');
      }
      
      if (data.status === 'FAILED') {
        setIsProcessing(false);
        if (pollInterval) {
          clearInterval(pollInterval);
          setPollInterval(null);
        }
        toast.error('Analysis failed. Please try again.');
      }
      
    } catch (error) {
      console.error('Failed to fetch scan:', error);
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
      toast.error('Failed to load scan data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlices = (data) => {
    // Generate simulated slices for 3D visualization
    const slices = [];
    for (let i = 0; i < 20; i++) {
      slices.push({
        index: i,
        sliceData: `Slice ${i + 1}`,
        opacity: 0.1 + (i / 20) * 0.5
      });
    }
    return slices;
  };

  const handleReprocess = async () => {
    try {
      await api.reprocessScan(id, token);
      toast.success('Reprocessing started');
      setIsProcessing(true);
      // Start polling again
      const interval = setInterval(() => {
        fetchScanData();
      }, 2000);
      setPollInterval(interval);
    } catch (error) {
      toast.error('Failed to start reprocessing');
    }
  };

  const handleSliceChange = (direction) => {
    if (direction === 'next' && currentSlice < slices.length - 1) {
      setCurrentSlice(currentSlice + 1);
    } else if (direction === 'prev' && currentSlice > 0) {
      setCurrentSlice(currentSlice - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Scan Analysis
              </h2>
              <p className="text-sm text-gray-500">
                ID: {scan?.id} • Type: {scan?.scan_type} • Status: {scan?.status}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {scan?.status === 'COMPLETED' && (
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Confidence: {(scan.confidence_score * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              
              <button
                onClick={handleReprocess}
                disabled={isProcessing}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
              </button>
              
              <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scan Viewer */}
        <div className="relative" style={{ height: '600px' }}>
          {isProcessing ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-600">Processing scan...</p>
                <p className="text-sm text-gray-400">This may take a few moments</p>
              </div>
            </div>
          ) : (
            <ThreeDViewer
              scanData={scan?.processed_file}
              maskData={scan?.anomaly_details}
              slices={slices}
              currentSlice={currentSlice}
            />
          )}
        </div>

        {/* Controls */}
        {slices.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <button
                onClick={() => handleSliceChange('prev')}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={currentSlice === 0}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Slice {currentSlice + 1} of {slices.length}
                </span>
                <input
                  type="range"
                  min="0"
                  max={slices.length - 1}
                  value={currentSlice}
                  onChange={(e) => setCurrentSlice(parseInt(e.target.value))}
                  className="w-64 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              
              <button
                onClick={() => handleSliceChange('next')}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={currentSlice === slices.length - 1}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Results Details */}
        {scan?.status === 'COMPLETED' && scan.anomaly_details?.detected && (
          <div className="p-6 border-t bg-red-50">
            <h3 className="text-lg font-semibold text-red-800 mb-3">
              Anomalies Detected
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scan.anomaly_details.anomalies?.map((anomaly, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow-sm">
                  <p className="text-sm text-gray-600">
                    Region {index + 1}
                  </p>
                  <p className="text-sm font-medium">
                    Confidence: {(anomaly.confidence * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">
                    Area: {anomaly.area} pixels
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {scan?.status === 'COMPLETED' && !scan.anomaly_details?.detected && (
          <div className="p-6 border-t bg-green-50">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-green-800">
                ✅ No Anomalies Detected
              </h3>
              <p className="text-sm text-green-600">
                The scan appears normal with {scan.confidence_score * 100}% confidence
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};