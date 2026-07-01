import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export const api = {
  // Auth
  login: async (username, password) => {
    const response = await axios.post(`${API_URL}/auth/token/`, { username, password });
    return response.data;
  },
  
  register: async (userData) => {
    const response = await axios.post(`${API_URL}/users/`, userData);
    return response.data;
  },
  
  // Scans
  uploadScan: async (formData, token, onProgress) => {
    const response = await axios.post(`${API_URL}/scans/`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
    });
    return response;
  },
  
  getScan: async (id, token) => {
    const response = await axios.get(`${API_URL}/scans/${id}/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response;
  },
  
  getScanResult: async (id, token) => {
    const response = await axios.get(`${API_URL}/scans/${id}/result/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response;
  },
  
  reprocessScan: async (id, token) => {
    const response = await axios.post(`${API_URL}/scans/${id}/reprocess/`, {}, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response;
  },
  
  getHistory: async (token) => {
    const response = await axios.get(`${API_URL}/scans/`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response;
  },
};