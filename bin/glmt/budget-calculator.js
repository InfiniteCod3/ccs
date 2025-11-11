#!/usr/bin/env node
'use strict';

/**
 * BudgetCalculator - Control thinking enable/disable based on task complexity
 *
 * Purpose: Z.AI API only supports binary thinking (on/off), not reasoning_effort levels.
 * This module decides when to enable thinking based on task type and budget preferences.
 *
 * Usage:
 *   const calculator = new BudgetCalculator();
 *   const shouldThink = calculator.shouldEnableThinking(taskType, envBudget);
 *
 * Configuration:
 *   CCS_GLMT_THINKING_BUDGET:
 *     - 0 or "unlimited": Always enable thinking (power user mode)
 *     - 1-2048: Disable thinking (fast execution, low budget)
 *     - 2049-8192: Enable thinking for reasoning tasks only (default)
 *     - >8192: Always enable thinking (high budget)
 *
 * Task type mapping:
 *   - reasoning: Enable thinking (planning, design, analysis)
 *   - execution: Disable thinking (fix, implement, debug) unless high budget
 *   - mixed: Enable thinking if budget >= medium threshold
 */
class BudgetCalculator {
  constructor(options = {}) {
    this.budgetThresholds = {
      low: 2048,      // Disable thinking (fast execution)
      medium: 8192    // Enable thinking for reasoning tasks
    };
    this.defaultBudget = options.defaultBudget || 8192; // Default: enable thinking for reasoning
  }

  /**
   * Determine if thinking should be enabled based on task type and budget
   * @param {string} taskType - 'reasoning', 'execution', or 'mixed'
   * @param {string|number} envBudget - CCS_GLMT_THINKING_BUDGET value
   * @returns {boolean} True if thinking should be enabled
   */
  shouldEnableThinking(taskType, envBudget) {
    const budget = this._parseBudget(envBudget);

    // Unlimited budget (0): Always enable thinking
    if (budget === 0) {
      return true;
    }

    // Low budget (<= 2048): Disable thinking (fast execution mode)
    if (budget <= this.budgetThresholds.low) {
      return false;
    }

    // High budget (> 8192): Always enable thinking
    if (budget > this.budgetThresholds.medium) {
      return true;
    }

    // Medium budget (2049-8192): Task-aware decision
    if (taskType === 'reasoning') {
      return true;  // Enable thinking for planning/design tasks
    } else if (taskType === 'execution') {
      return false; // Disable thinking for quick fixes
    } else {
      return true;  // Enable for mixed/ambiguous tasks (default safe)
    }
  }

  /**
   * Parse budget from environment variable or use default
   * @param {string|number} envBudget - Budget value
   * @returns {number} Parsed budget (0 = unlimited)
   * @private
   */
  _parseBudget(envBudget) {
    // CRITICAL: Check for undefined/null explicitly, not falsy (0 is valid!)
    if (envBudget === undefined || envBudget === null || envBudget === '') {
      return this.defaultBudget;
    }

    // Handle string values
    if (typeof envBudget === 'string') {
      if (envBudget.toLowerCase() === 'unlimited') {
        return 0;
      }
      const parsed = parseInt(envBudget, 10);
      if (isNaN(parsed)) {
        return this.defaultBudget;
      }
      return parsed < 0 ? 0 : parsed;
    }

    // Handle number values
    if (typeof envBudget === 'number') {
      return envBudget < 0 ? 0 : envBudget;
    }

    return this.defaultBudget;
  }

  /**
   * Get human-readable budget description
   * @param {number} budget - Budget value
   * @returns {string} Description
   */
  getBudgetDescription(budget) {
    if (budget === 0) return 'unlimited (always think)';
    if (budget <= this.budgetThresholds.low) return 'low (fast execution, no thinking)';
    if (budget <= this.budgetThresholds.medium) return 'medium (task-aware thinking)';
    return 'high (always think)';
  }
}

module.exports = BudgetCalculator;
