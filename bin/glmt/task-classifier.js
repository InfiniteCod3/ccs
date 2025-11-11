#!/usr/bin/env node
'use strict';

/**
 * TaskClassifier - Classify user prompts as reasoning, execution, or mixed tasks
 *
 * Purpose: Determine task type to inform thinking enable/disable decision.
 * Uses keyword-based matching for fast, deterministic classification.
 *
 * Usage:
 *   const classifier = new TaskClassifier();
 *   const taskType = classifier.classify(messages);
 *
 * Task types:
 *   - reasoning: Planning, design, analysis (enable thinking)
 *   - execution: Implementation, fixes, debugging (disable thinking for speed)
 *   - mixed: Ambiguous or both (default to safe thinking mode)
 *
 * Classification strategy:
 *   1. Extract text from all user messages
 *   2. Score against reasoning and execution keyword lists
 *   3. Return type with highest score (or 'mixed' if tied/no matches)
 */
class TaskClassifier {
  constructor(options = {}) {
    this.keywords = {
      reasoning: [
        'plan', 'design', 'analyze', 'architecture', 'strategy',
        'approach', 'consider', 'evaluate', 'research', 'explore',
        'brainstorm', 'think about', 'pros and cons', 'alternatives',
        'compare', 'recommend', 'assess', 'review', 'investigate'
      ],
      execution: [
        'fix', 'implement', 'debug', 'refactor', 'optimize',
        'add', 'remove', 'update', 'create', 'delete',
        'change', 'modify', 'replace', 'move', 'rename',
        'test', 'run', 'execute', 'deploy', 'build'
      ]
    };

    // Allow custom keywords via options
    if (options.customKeywords) {
      this.keywords = { ...this.keywords, ...options.customKeywords };
    }
  }

  /**
   * Classify messages as reasoning, execution, or mixed
   * @param {Array} messages - Messages array
   * @returns {string} 'reasoning', 'execution', or 'mixed'
   */
  classify(messages) {
    if (!messages || messages.length === 0) {
      return 'mixed'; // Default to safe mode
    }

    // Extract text from all user messages
    const text = messages
      .filter(m => m.role === 'user')
      .map(m => this._extractText(m.content))
      .join(' ')
      .toLowerCase();

    if (!text.trim()) {
      return 'mixed'; // No text found
    }

    // Score against keyword lists
    const reasoningScore = this._matchScore(text, this.keywords.reasoning);
    const executionScore = this._matchScore(text, this.keywords.execution);

    // Classify based on scores
    if (reasoningScore > executionScore) {
      return 'reasoning';
    } else if (executionScore > reasoningScore) {
      return 'execution';
    } else {
      return 'mixed'; // Tied or no matches
    }
  }

  /**
   * Extract text from message content
   * @param {string|Array} content - Message content
   * @returns {string} Extracted text
   * @private
   */
  _extractText(content) {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter(block => block.type === 'text')
        .map(block => block.text || '')
        .join(' ');
    }

    return '';
  }

  /**
   * Calculate keyword match score
   * @param {string} text - Text to search
   * @param {Array} keywords - Keywords to match
   * @returns {number} Number of matches
   * @private
   */
  _matchScore(text, keywords) {
    return keywords.reduce((score, keyword) => {
      // Support both exact match and word boundary match
      const regex = new RegExp(`\\b${this._escapeRegex(keyword)}\\b`, 'i');
      return score + (regex.test(text) ? 1 : 0);
    }, 0);
  }

  /**
   * Escape special regex characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get classification details (for debugging)
   * @param {Array} messages - Messages array
   * @returns {Object} { type, reasoningScore, executionScore, text }
   */
  classifyWithDetails(messages) {
    const text = messages
      .filter(m => m.role === 'user')
      .map(m => this._extractText(m.content))
      .join(' ')
      .toLowerCase();

    const reasoningScore = this._matchScore(text, this.keywords.reasoning);
    const executionScore = this._matchScore(text, this.keywords.execution);

    let type;
    if (reasoningScore > executionScore) {
      type = 'reasoning';
    } else if (executionScore > reasoningScore) {
      type = 'execution';
    } else {
      type = 'mixed';
    }

    return {
      type,
      reasoningScore,
      executionScore,
      textLength: text.length,
      textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    };
  }
}

module.exports = TaskClassifier;
