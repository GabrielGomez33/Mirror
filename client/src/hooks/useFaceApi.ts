// src/hooks/useFaceApi.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

// Type for face detection results
type FaceDetectionResult = faceapi.WithFaceExpressions<
  faceapi.WithFaceLandmarks<
    { detection: faceapi.FaceDetection },
    faceapi.FaceLandmarks68
  >
>;

const CONFIG = {
  MODELS_BASE_PATH: '/Mirror/models/faceapi'
};

export const useFaceApi = () => {
  const [isModelLoaded, setModelLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const isProcessingRef = useRef(false);

  // Initialize and load models
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingProgress('Initializing face detection...');
        
        // The @vladmandic/face-api uses tf internally
        // Set backend to webgl (it should handle this automatically)
        const tf = faceapi.tf;
        console.log('TensorFlow version:', tf.version);
        
        // Load models
        setLoadingProgress('Loading models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODELS_BASE_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CONFIG.MODELS_BASE_PATH);
        await faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.MODELS_BASE_PATH);
        
        setModelLoaded(true);
        setLoadingProgress('Ready');
        console.log('Face detection models loaded successfully');
      } catch (error) {
        console.error('Initialization error:', error);
        setLoadingError(error instanceof Error ? error.message : 'Failed to initialize');
      }
    };

    init();
  }, []);

  // Face detection function
  const analyzeImage = useCallback(
    async (image: HTMLImageElement): Promise<FaceDetectionResult> => {
      if (!isModelLoaded) {
        throw new Error('Models not yet loaded');
      }

      if (isProcessingRef.current) {
        throw new Error('Another analysis is already in progress');
      }

      isProcessingRef.current = true;

      try {
        // Detect face directly from image
        const detections = await faceapi
          .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.5
          }))
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detections) {
          // Try with lower threshold
          const retry = await faceapi
            .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({
              inputSize: 320,
              scoreThreshold: 0.3
            }))
            .withFaceLandmarks()
            .withFaceExpressions();
            
          if (!retry) {
            throw new Error('No face detected in the image');
          }
          
          return retry;
        }

        console.log('Face detected successfully');
        return detections;

      } catch (error) {
        console.error('Face detection error:', error);
        
        // If it's the backend error, provide specific guidance
        if (error instanceof Error && error.message.includes('backend')) {
          throw new Error('WebGL backend error. Try refreshing the page or using a different browser.');
        }
        
        throw error;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [isModelLoaded]
  );

  return {
    isModelLoaded,
    loadingError,
    loadingProgress,
    analyzeImage,
  };
};
