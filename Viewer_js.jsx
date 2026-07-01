import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Plane, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

const MedicalViewer = ({ scanData, maskData, slices, currentSlice }) => {
  return (
    <div className="w-full h-full bg-gray-900 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        
        {/* Main medical scan rendering */}
        <MedicalImage 
          scanData={scanData} 
          maskData={maskData} 
          currentSlice={currentSlice}
        />
        
        {/* Anomaly markers */}
        {maskData && maskData.anomalies && maskData.anomalies.map((anomaly, index) => (
          <AnomalyMarker key={index} anomaly={anomaly} />
        ))}
        
        {/* 3D Reconstruction for volume data */}
        {slices && slices.length > 0 && (
          <VolumeReconstruction slices={slices} currentSlice={currentSlice} />
        )}
      </Canvas>
    </div>
  );
};

const MedicalImage = ({ scanData, maskData, currentSlice }) => {
  const meshRef = useRef();
  
  useEffect(() => {
    if (scanData && meshRef.current) {
      // Create texture from scan data
      const texture = new THREE.Texture(scanData);
      texture.needsUpdate = true;
      meshRef.current.material.map = texture;
      meshRef.current.material.needsUpdate = true;
    }
  }, [scanData]);
  
  return (
    <Plane ref={meshRef} args={[4, 4]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshBasicMaterial color="white" side={THREE.DoubleSide} />
    </Plane>
  );
};

const AnomalyMarker = ({ anomaly }) => {
  const [bbox] = useState(anomaly.bbox);
  
  const width = (bbox[2] - bbox[0]) / 512 * 4;
  const height = (bbox[3] - bbox[1]) / 512 * 4;
  const x = ((bbox[0] + bbox[2]) / 2 / 512 - 0.5) * 4;
  const y = ((bbox[1] + bbox[3]) / 2 / 512 - 0.5) * 4;
  
  return (
    <group position={[0, 0, 0]}>
      {/* 3D bounding box for anomaly */}
      <Box 
        position={[x, y, 0]} 
        args={[width, height, 0.01]}
        scale={[1, 1, 1]}
      >
        <meshBasicMaterial 
          color="red" 
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </Box>
      <Text
        position={[x, y + 0.5, 0]}
        fontSize={0.15}
        color="red"
        anchorX="center"
        anchorY="bottom"
      >
        {`Confidence: ${(anomaly.confidence * 100).toFixed(1)}%`}
      </Text>
    </group>
  );
};

const VolumeReconstruction = ({ slices, currentSlice }) => {
  const groupRef = useRef();
  
  useFrame(() => {
    if (groupRef.current) {
      // Smoothly rotate the volume
      groupRef.current.rotation.y += 0.001;
    }
  });
  
  return (
    <group ref={groupRef} position={[0, 0, -0.5]}>
      {slices.map((slice, index) => (
        <Plane 
          key={index}
          args={[3, 3]} 
          position={[0, 0, (index / slices.length - 0.5) * 2]}
          rotation={[0, 0, 0]}
        >
          <meshBasicMaterial 
            color={new THREE.Color(`hsl(${index / slices.length * 360}, 70%, 50%)`)}
            transparent 
            opacity={0.1 + (index / slices.length) * 0.5}
            side={THREE.DoubleSide}
          />
        </Plane>
      ))}
    </group>
  );
};

export default MedicalViewer;