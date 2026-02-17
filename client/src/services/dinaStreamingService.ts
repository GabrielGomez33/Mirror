// ============================================================================
// DINA STREAMING SERVICE - Frontend handler for streaming Dina responses
// ============================================================================
// File: src/services/dinaStreamingService.ts
//
// Purpose: Handles real-time streaming of Dina responses via WebSocket.
// Manages streaming state, chunk accumulation, and UI updates.
// ============================================================================

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamingMessage {
  messageId: string;
  groupId: string;
  senderUserId: number;
  senderUsername: string;
  status: 'streaming' | 'complete' | 'error';
  content: string;
  chunks: string[];
  chunkIndex: number;
  startTime: number;
  lastChunkTime: number;
  error?: string;
}

export interface StreamChunkEvent {
  messageId: string;
  chunk: string;
  chunkIndex: number;
  accumulatedLength: number;
}

export interface StreamCompleteEvent {
  messageId: string;
  finalContent: string;
  totalChunks: number;
  totalTime: number;
}

export interface StreamStartEvent {
  messageId: string;
  senderUserId: number;
  senderUsername: string;
}

type StreamEventCallback = (message: StreamingMessage) => void;

// ============================================================================
// DINA STREAMING SERVICE CLASS
// ============================================================================

class DinaStreamingService extends EventEmitter {
  private activeStreams: Map<string, StreamingMessage> = new Map();
  private streamCallbacks: Map<string, Set<StreamEventCallback>> = new Map();
  private globalCallbacks: Set<StreamEventCallback> = new Set();

  // Configuration
  private readonly STREAM_TIMEOUT_MS = 30000; // 30 second timeout

  constructor() {
    super();
    console.log('🌊 DinaStreamingService initialized');
  }

  // ============================================================================
  // STREAM MANAGEMENT
  // ============================================================================

  /**
   * Handle stream start event from WebSocket
   */
  handleStreamStart(event: StreamStartEvent): void {
    const { messageId, senderUserId, senderUsername } = event;

    const streamingMessage: StreamingMessage = {
      messageId,
      groupId: '', // Will be set from context
      senderUserId,
      senderUsername,
      status: 'streaming',
      content: '',
      chunks: [],
      chunkIndex: 0,
      startTime: Date.now(),
      lastChunkTime: Date.now(),
    };

    this.activeStreams.set(messageId, streamingMessage);
    this.notifyListeners(messageId, streamingMessage);

    // Set timeout for stale streams
    setTimeout(() => {
      const stream = this.activeStreams.get(messageId);
      if (stream && stream.status === 'streaming') {
        this.handleStreamTimeout(messageId);
      }
    }, this.STREAM_TIMEOUT_MS);

    console.log(`🌊 Stream started: ${messageId}`);
  }

  /**
   * Handle incoming stream chunk from WebSocket
   */
  handleStreamChunk(event: StreamChunkEvent): void {
    const { messageId, chunk, chunkIndex } = event;

    const stream = this.activeStreams.get(messageId);
    if (!stream) {
      console.warn(`⚠️ Received chunk for unknown stream: ${messageId}`);
      return;
    }

    // Update stream state
    stream.content += chunk;
    stream.chunks.push(chunk);
    stream.chunkIndex = chunkIndex;
    stream.lastChunkTime = Date.now();

    this.notifyListeners(messageId, stream);
  }

  /**
   * Handle stream complete event from WebSocket
   */
  handleStreamComplete(event: StreamCompleteEvent): void {
    const { messageId, finalContent, totalChunks, totalTime } = event;

    const stream = this.activeStreams.get(messageId);
    if (!stream) {
      console.warn(`⚠️ Stream complete for unknown stream: ${messageId}`);
      return;
    }

    // Update final state
    stream.status = 'complete';
    stream.content = finalContent || stream.content;
    stream.chunkIndex = totalChunks;

    this.notifyListeners(messageId, stream);

    // Clean up after a short delay (allow UI to update)
    setTimeout(() => {
      this.activeStreams.delete(messageId);
      this.streamCallbacks.delete(messageId);
    }, 1000);

    console.log(`✅ Stream complete: ${messageId} (${totalChunks} chunks, ${totalTime}ms)`);
  }

  /**
   * Handle stream error
   */
  handleStreamError(messageId: string, error: string): void {
    const stream = this.activeStreams.get(messageId);
    if (!stream) return;

    stream.status = 'error';
    stream.error = error;

    this.notifyListeners(messageId, stream);

    // Clean up
    setTimeout(() => {
      this.activeStreams.delete(messageId);
      this.streamCallbacks.delete(messageId);
    }, 1000);

    console.error(`❌ Stream error: ${messageId} - ${error}`);
  }

  /**
   * Handle stream timeout
   */
  private handleStreamTimeout(messageId: string): void {
    const stream = this.activeStreams.get(messageId);
    if (!stream || stream.status !== 'streaming') return;

    stream.status = 'error';
    stream.error = 'Stream timed out';

    this.notifyListeners(messageId, stream);
    this.activeStreams.delete(messageId);

    console.warn(`⏰ Stream timed out: ${messageId}`);
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Subscribe to updates for a specific message stream
   */
  subscribeToStream(messageId: string, callback: StreamEventCallback): () => void {
    if (!this.streamCallbacks.has(messageId)) {
      this.streamCallbacks.set(messageId, new Set());
    }

    this.streamCallbacks.get(messageId)!.add(callback);

    // Immediately call with current state if stream exists
    const stream = this.activeStreams.get(messageId);
    if (stream) {
      callback(stream);
    }

    // Return unsubscribe function
    return () => {
      this.streamCallbacks.get(messageId)?.delete(callback);
    };
  }

  /**
   * Subscribe to all stream updates
   */
  subscribeToAllStreams(callback: StreamEventCallback): () => void {
    this.globalCallbacks.add(callback);

    return () => {
      this.globalCallbacks.delete(callback);
    };
  }

  /**
   * Notify all relevant listeners of stream updates
   */
  private notifyListeners(messageId: string, stream: StreamingMessage): void {
    // Notify message-specific callbacks
    const messageCallbacks = this.streamCallbacks.get(messageId);
    if (messageCallbacks) {
      messageCallbacks.forEach((cb) => {
        try {
          cb(stream);
        } catch (error) {
          console.error('Error in stream callback:', error);
        }
      });
    }

    // Notify global callbacks
    this.globalCallbacks.forEach((cb) => {
      try {
        cb(stream);
      } catch (error) {
        console.error('Error in global stream callback:', error);
      }
    });

    // Emit event for EventEmitter subscribers
    this.emit('streamUpdate', stream);
  }

  // ============================================================================
  // STATE QUERIES
  // ============================================================================

  /**
   * Check if a message is currently streaming
   */
  isStreaming(messageId: string): boolean {
    const stream = this.activeStreams.get(messageId);
    return stream?.status === 'streaming';
  }

  /**
   * Get the current content for a streaming message
   */
  getStreamContent(messageId: string): string {
    return this.activeStreams.get(messageId)?.content || '';
  }

  /**
   * Get the full stream state for a message
   */
  getStreamState(messageId: string): StreamingMessage | undefined {
    return this.activeStreams.get(messageId);
  }

  /**
   * Get all active streams
   */
  getActiveStreams(): Map<string, StreamingMessage> {
    return new Map(this.activeStreams);
  }

  /**
   * Get count of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Format streaming content with cursor indicator
   */
  formatStreamingContent(messageId: string, showCursor: boolean = true): string {
    const stream = this.activeStreams.get(messageId);
    if (!stream) return '';

    let content = stream.content;

    if (stream.status === 'streaming' && showCursor) {
      content += '▌'; // Blinking cursor effect
    }

    return content;
  }

  /**
   * Calculate streaming progress (0-100)
   */
  getStreamProgress(messageId: string): number {
    const stream = this.activeStreams.get(messageId);
    if (!stream || stream.status === 'complete') return 100;
    if (stream.status === 'error') return 0;

    // Estimate based on time elapsed (30s max)
    const elapsed = Date.now() - stream.startTime;
    return Math.min(99, Math.floor((elapsed / this.STREAM_TIMEOUT_MS) * 100));
  }

  /**
   * Clean up all streams (for unmount)
   */
  cleanup(): void {
    this.activeStreams.clear();
    this.streamCallbacks.clear();
    this.globalCallbacks.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

const dinaStreamingService = new DinaStreamingService();

// ============================================================================
// WEBSOCKET EVENT INTEGRATION
// ============================================================================

/**
 * Setup WebSocket event handlers for streaming
 * Call this after WebSocket connection is established
 */
export function setupStreamingWebSocketHandlers(
  onEvent: (event: string, handler: (data: any) => void) => () => void
): () => void {
  const unsubscribers: Array<() => void> = [];

  // Handle stream start
  unsubscribers.push(
    onEvent('dina:stream_start', (data: StreamStartEvent) => {
      dinaStreamingService.handleStreamStart(data);
    })
  );

  // Handle stream chunks
  unsubscribers.push(
    onEvent('dina:stream_chunk', (data: StreamChunkEvent) => {
      dinaStreamingService.handleStreamChunk(data);
    })
  );

  // Handle stream complete
  unsubscribers.push(
    onEvent('dina:stream_complete', (data: StreamCompleteEvent) => {
      dinaStreamingService.handleStreamComplete(data);
    })
  );

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ============================================================================
// REACT HOOK FOR STREAMING
// ============================================================================

import { useState, useEffect } from 'react';

/**
 * React hook for consuming streaming message content
 */
export function useStreamingMessage(messageId: string | null): {
  isStreaming: boolean;
  content: string;
  status: 'idle' | 'streaming' | 'complete' | 'error';
  progress: number;
  error?: string;
} {
  const [state, setState] = useState<{
    isStreaming: boolean;
    content: string;
    status: 'idle' | 'streaming' | 'complete' | 'error';
    progress: number;
    error?: string;
  }>({
    isStreaming: false,
    content: '',
    status: 'idle',
    progress: 0,
  });

  useEffect(() => {
    if (!messageId) {
      setState({
        isStreaming: false,
        content: '',
        status: 'idle',
        progress: 0,
      });
      return;
    }

    // Check if already streaming
    const existingStream = dinaStreamingService.getStreamState(messageId);
    if (existingStream) {
      setState({
        isStreaming: existingStream.status === 'streaming',
        content: existingStream.content,
        status: existingStream.status,
        progress: dinaStreamingService.getStreamProgress(messageId),
        error: existingStream.error,
      });
    }

    // Subscribe to updates
    const unsubscribe = dinaStreamingService.subscribeToStream(
      messageId,
      (stream) => {
        setState({
          isStreaming: stream.status === 'streaming',
          content: stream.content,
          status: stream.status,
          progress: dinaStreamingService.getStreamProgress(messageId),
          error: stream.error,
        });
      }
    );

    return unsubscribe;
  }, [messageId]);

  return state;
}

/**
 * React hook for tracking all active streams
 */
export function useActiveStreams(): Map<string, StreamingMessage> {
  const [streams, setStreams] = useState<Map<string, StreamingMessage>>(new Map());

  useEffect(() => {
    const updateStreams = () => {
      setStreams(new Map(dinaStreamingService.getActiveStreams()));
    };

    // Initial state
    updateStreams();

    // Subscribe to all updates
    const unsubscribe = dinaStreamingService.subscribeToAllStreams(() => {
      updateStreams();
    });

    return unsubscribe;
  }, []);

  return streams;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  dinaStreamingService,
  DinaStreamingService,
};

export default dinaStreamingService;
