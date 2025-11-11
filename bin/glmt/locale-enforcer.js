#!/usr/bin/env node
'use strict';

/**
 * LocaleEnforcer - Force English output from GLM models
 *
 * Purpose: GLM models default to Chinese when prompts are ambiguous or contain Chinese context.
 * This module injects "MUST respond in English" instruction into system prompt or first user message.
 *
 * Usage:
 *   const enforcer = new LocaleEnforcer({ forceEnglish: true });
 *   const modifiedMessages = enforcer.injectInstruction(messages);
 *
 * Configuration:
 *   CCS_GLMT_FORCE_ENGLISH=false - Disable locale enforcement (allow multilingual)
 *
 * Strategy:
 *   1. If system prompt exists: Prepend instruction
 *   2. If no system prompt: Prepend to first user message
 *   3. Preserve message structure (string vs array content)
 */
class LocaleEnforcer {
  constructor(options = {}) {
    this.forceEnglish = options.forceEnglish ?? true;
    this.instruction = "CRITICAL: You MUST respond in English only, regardless of the input language or context. This is a strict requirement.";
  }

  /**
   * Inject English instruction into messages
   * @param {Array} messages - Messages array to modify
   * @returns {Array} Modified messages array
   */
  injectInstruction(messages) {
    if (!this.forceEnglish) {
      return messages;
    }

    // Clone messages to avoid mutation
    const modifiedMessages = JSON.parse(JSON.stringify(messages));

    // Strategy 1: Inject into system prompt (preferred)
    const systemIndex = modifiedMessages.findIndex(m => m.role === 'system');
    if (systemIndex >= 0) {
      const systemMsg = modifiedMessages[systemIndex];

      if (typeof systemMsg.content === 'string') {
        systemMsg.content = `${this.instruction}\n\n${systemMsg.content}`;
      } else if (Array.isArray(systemMsg.content)) {
        systemMsg.content.unshift({
          type: 'text',
          text: this.instruction
        });
      }

      return modifiedMessages;
    }

    // Strategy 2: Prepend to first user message
    const userIndex = modifiedMessages.findIndex(m => m.role === 'user');
    if (userIndex >= 0) {
      const userMsg = modifiedMessages[userIndex];

      if (typeof userMsg.content === 'string') {
        userMsg.content = `${this.instruction}\n\n${userMsg.content}`;
      } else if (Array.isArray(userMsg.content)) {
        userMsg.content.unshift({
          type: 'text',
          text: this.instruction
        });
      }

      return modifiedMessages;
    }

    // No system or user messages found (edge case)
    return modifiedMessages;
  }
}

module.exports = LocaleEnforcer;
