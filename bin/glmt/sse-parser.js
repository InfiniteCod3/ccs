#!/usr/bin/env node
'use strict';

/**
 * SSEParser - Parse Server-Sent Events (SSE) stream
 *
 * Handles:
 * - Incomplete events across chunks
 * - Multiple events in single chunk
 * - Malformed data (skip gracefully)
 * - [DONE] marker
 *
 * Usage:
 *   const parser = new SSEParser();
 *   stream.on('data', chunk => {
 *     const events = parser.parse(chunk);
 *     events.forEach(event => { ... });
 *   });
 */
class SSEParser {
  constructor(options = {}) {
    this.buffer = '';
    this.eventCount = 0;
    this.maxBufferSize = options.maxBufferSize || 1024 * 1024; // 1MB default
  }

  /**
   * Parse chunk and extract SSE events
   * @param {Buffer|string} chunk - Data chunk from stream
   * @returns {Array<Object>} Array of parsed events
   */
  parse(chunk) {
    this.buffer += chunk.toString();

    // C-01 Fix: Prevent unbounded buffer growth (DoS protection)
    if (this.buffer.length > this.maxBufferSize) {
      throw new Error(`SSE buffer exceeded ${this.maxBufferSize} bytes (DoS protection)`);
    }

    const lines = this.buffer.split('\n');

    // Keep incomplete line in buffer
    this.buffer = lines.pop() || '';

    const events = [];
    let currentEvent = { event: 'message', data: '' };

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent.event = line.substring(7).trim();
      } else if (line.startsWith('data: ')) {
        const data = line.substring(6);

        if (data === '[DONE]') {
          this.eventCount++;
          events.push({
            event: 'done',
            data: null,
            index: this.eventCount
          });
          currentEvent = { event: 'message', data: '' };
        } else {
          try {
            currentEvent.data = JSON.parse(data);
            this.eventCount++;
            currentEvent.index = this.eventCount;
            events.push(currentEvent);
            currentEvent = { event: 'message', data: '' };
          } catch (e) {
            // H-01 Fix: Log parse errors for debugging
            if (typeof console !== 'undefined' && console.error) {
              console.error('[SSEParser] Malformed JSON event:', e.message, 'Data:', data.substring(0, 100));
            }
          }
        }
      } else if (line.startsWith('id: ')) {
        currentEvent.id = line.substring(4).trim();
      } else if (line.startsWith('retry: ')) {
        currentEvent.retry = parseInt(line.substring(7), 10);
      }
      // Empty lines separate events (already handled by JSON parsing)
    }

    return events;
  }

  /**
   * Reset parser state (for reuse)
   */
  reset() {
    this.buffer = '';
    this.eventCount = 0;
  }
}

module.exports = SSEParser;
