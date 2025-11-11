#!/usr/bin/env node
'use strict';

/**
 * DeltaAccumulator - Maintain state across streaming deltas
 *
 * Tracks:
 * - Message metadata (id, model, role)
 * - Content blocks (thinking, text)
 * - Current block index
 * - Accumulated content
 *
 * Usage:
 *   const acc = new DeltaAccumulator(thinkingConfig);
 *   const events = transformer.transformDelta(openaiEvent, acc);
 */
class DeltaAccumulator {
  constructor(thinkingConfig = {}, options = {}) {
    this.thinkingConfig = thinkingConfig;
    this.messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(7);
    this.model = null;
    this.role = 'assistant';

    // Content blocks
    this.contentBlocks = [];
    this.currentBlockIndex = -1;

    // Tool calls tracking
    this.toolCalls = [];
    this.toolCallsIndex = {};

    // Buffers
    this.thinkingBuffer = '';
    this.textBuffer = '';

    // C-02 Fix: Limits to prevent unbounded accumulation
    this.maxBlocks = options.maxBlocks || 100;
    this.maxBufferSize = options.maxBufferSize || 10 * 1024 * 1024; // 10MB

    // Loop detection configuration
    this.loopDetectionThreshold = options.loopDetectionThreshold || 3;
    this.loopDetected = false;

    // State flags
    this.messageStarted = false;
    this.finalized = false;
    this.usageReceived = false; // Track if usage data has arrived

    // Statistics
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.finishReason = null;
  }

  /**
   * Get current content block
   * @returns {Object|null} Current block or null
   */
  getCurrentBlock() {
    if (this.currentBlockIndex >= 0 && this.currentBlockIndex < this.contentBlocks.length) {
      return this.contentBlocks[this.currentBlockIndex];
    }
    return null;
  }

  /**
   * Start new content block
   * @param {string} type - Block type ('thinking', 'text', or 'tool_use')
   * @returns {Object} New block
   */
  startBlock(type) {
    // C-02 Fix: Enforce max blocks limit
    if (this.contentBlocks.length >= this.maxBlocks) {
      throw new Error(`Maximum ${this.maxBlocks} content blocks exceeded (DoS protection)`);
    }

    this.currentBlockIndex++;
    const block = {
      index: this.currentBlockIndex,
      type: type,
      content: '',
      started: true,
      stopped: false
    };
    this.contentBlocks.push(block);

    // Reset buffer for new block (tool_use doesn't use buffers)
    if (type === 'thinking') {
      this.thinkingBuffer = '';
    } else if (type === 'text') {
      this.textBuffer = '';
    }

    return block;
  }

  /**
   * Add delta to current block
   * @param {string} delta - Content delta
   */
  addDelta(delta) {
    const block = this.getCurrentBlock();
    if (block) {
      if (block.type === 'thinking') {
        // C-02 Fix: Enforce buffer size limit
        if (this.thinkingBuffer.length + delta.length > this.maxBufferSize) {
          throw new Error(`Thinking buffer exceeded ${this.maxBufferSize} bytes (DoS protection)`);
        }
        this.thinkingBuffer += delta;
        block.content = this.thinkingBuffer;
      } else if (block.type === 'text') {
        // C-02 Fix: Enforce buffer size limit
        if (this.textBuffer.length + delta.length > this.maxBufferSize) {
          throw new Error(`Text buffer exceeded ${this.maxBufferSize} bytes (DoS protection)`);
        }
        this.textBuffer += delta;
        block.content = this.textBuffer;
      }
    }
  }

  /**
   * Mark current block as stopped
   */
  stopCurrentBlock() {
    const block = this.getCurrentBlock();
    if (block) {
      block.stopped = true;
    }
  }

  /**
   * Update usage statistics
   * @param {Object} usage - Usage object from OpenAI
   */
  updateUsage(usage) {
    if (usage) {
      this.inputTokens = usage.prompt_tokens || usage.input_tokens || 0;
      this.outputTokens = usage.completion_tokens || usage.output_tokens || 0;
      this.usageReceived = true; // Mark that we've received usage data
    }
  }

  /**
   * Add or update tool call delta
   * @param {Object} toolCallDelta - Tool call delta from OpenAI
   */
  addToolCallDelta(toolCallDelta) {
    const index = toolCallDelta.index;

    // Initialize tool call if not exists
    if (!this.toolCallsIndex[index]) {
      const toolCall = {
        index: index,
        id: '',
        type: 'function',
        function: {
          name: '',
          arguments: ''
        }
      };
      this.toolCalls.push(toolCall);
      this.toolCallsIndex[index] = toolCall;
    }

    const toolCall = this.toolCallsIndex[index];

    // Update id if present
    if (toolCallDelta.id) {
      toolCall.id = toolCallDelta.id;
    }

    // Update type if present
    if (toolCallDelta.type) {
      toolCall.type = toolCallDelta.type;
    }

    // Update function name if present
    if (toolCallDelta.function?.name) {
      toolCall.function.name += toolCallDelta.function.name;
    }

    // Update function arguments if present
    if (toolCallDelta.function?.arguments) {
      toolCall.function.arguments += toolCallDelta.function.arguments;
    }
  }

  /**
   * Get all tool calls
   * @returns {Array} Tool calls array
   */
  getToolCalls() {
    return this.toolCalls;
  }

  /**
   * Check for planning loop pattern
   * Loop = N consecutive thinking blocks with no tool calls
   * @returns {boolean} True if loop detected
   */
  checkForLoop() {
    // Already detected loop
    if (this.loopDetected) {
      return true;
    }

    // Need minimum blocks to detect pattern
    if (this.contentBlocks.length < this.loopDetectionThreshold) {
      return false;
    }

    // Get last N blocks
    const recentBlocks = this.contentBlocks.slice(-this.loopDetectionThreshold);

    // Check if all recent blocks are thinking blocks
    const allThinking = recentBlocks.every(b => b.type === 'thinking');

    // Check if no tool calls have been made at all
    const noToolCalls = this.toolCalls.length === 0;

    // Loop detected if: all recent blocks are thinking AND no tool calls yet
    if (allThinking && noToolCalls) {
      this.loopDetected = true;
      return true;
    }

    return false;
  }

  /**
   * Reset loop detection state (for testing)
   */
  resetLoopDetection() {
    this.loopDetected = false;
  }

  /**
   * Get summary of accumulated state
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      messageId: this.messageId,
      model: this.model,
      role: this.role,
      blockCount: this.contentBlocks.length,
      currentIndex: this.currentBlockIndex,
      toolCallCount: this.toolCalls.length,
      messageStarted: this.messageStarted,
      finalized: this.finalized,
      loopDetected: this.loopDetected,
      usage: {
        input_tokens: this.inputTokens,
        output_tokens: this.outputTokens
      }
    };
  }
}

module.exports = DeltaAccumulator;
