#!/usr/bin/env node
'use strict';

/**
 * BudgetCalculator Unit Tests
 *
 * Tests 4 scenarios:
 * 1. Default budget (8192) → Thinking enabled for reasoning tasks
 * 2. Low budget (2048) → Thinking disabled (fast execution)
 * 3. High budget (16384) → Thinking always enabled
 * 4. Unlimited (0) → Thinking always enabled
 */

const assert = require('assert');
const BudgetCalculator = require('../../../bin/glmt/budget-calculator');

describe('BudgetCalculator', () => {
  describe('Scenario 1: Default budget (8192) - Task-aware thinking', () => {
    it('should enable thinking for reasoning tasks with default budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', null);

      assert.strictEqual(result, true);
    });

    it('should disable thinking for execution tasks with default budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('execution', null);

      assert.strictEqual(result, false);
    });

    it('should enable thinking for mixed tasks with default budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('mixed', null);

      assert.strictEqual(result, true);
    });

    it('should use default budget (8192) when not specified', () => {
      const calculator = new BudgetCalculator();

      const budget = calculator._parseBudget(null);

      assert.strictEqual(budget, 8192);
    });

    it('should describe default budget correctly', () => {
      const calculator = new BudgetCalculator();

      const description = calculator.getBudgetDescription(8192);

      assert.strictEqual(description, 'medium (task-aware thinking)');
    });
  });

  describe('Scenario 2: Low budget (2048) - Fast execution, no thinking', () => {
    it('should disable thinking for reasoning tasks with low budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', 2048);

      assert.strictEqual(result, false);
    });

    it('should disable thinking for execution tasks with low budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('execution', 2048);

      assert.strictEqual(result, false);
    });

    it('should disable thinking for mixed tasks with low budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('mixed', 2048);

      assert.strictEqual(result, false);
    });

    it('should parse low budget from string', () => {
      const calculator = new BudgetCalculator();

      const budget = calculator._parseBudget('2048');

      assert.strictEqual(budget, 2048);
    });

    it('should describe low budget correctly', () => {
      const calculator = new BudgetCalculator();

      const description = calculator.getBudgetDescription(2048);

      assert.strictEqual(description, 'low (fast execution, no thinking)');
    });

    it('should treat budget <= 2048 as low budget', () => {
      const calculator = new BudgetCalculator();

      assert.strictEqual(calculator.shouldEnableThinking('reasoning', 1024), false);
      assert.strictEqual(calculator.shouldEnableThinking('reasoning', 2000), false);
      assert.strictEqual(calculator.shouldEnableThinking('reasoning', 2048), false);
    });
  });

  describe('Scenario 3: High budget (16384) - Always enable thinking', () => {
    it('should enable thinking for reasoning tasks with high budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', 16384);

      assert.strictEqual(result, true);
    });

    it('should enable thinking for execution tasks with high budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('execution', 16384);

      assert.strictEqual(result, true);
    });

    it('should enable thinking for mixed tasks with high budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('mixed', 16384);

      assert.strictEqual(result, true);
    });

    it('should parse high budget from string', () => {
      const calculator = new BudgetCalculator();

      const budget = calculator._parseBudget('16384');

      assert.strictEqual(budget, 16384);
    });

    it('should describe high budget correctly', () => {
      const calculator = new BudgetCalculator();

      const description = calculator.getBudgetDescription(16384);

      assert.strictEqual(description, 'high (always think)');
    });

    it('should treat budget > 8192 as high budget', () => {
      const calculator = new BudgetCalculator();

      assert.strictEqual(calculator.shouldEnableThinking('execution', 8193), true);
      assert.strictEqual(calculator.shouldEnableThinking('execution', 10000), true);
      assert.strictEqual(calculator.shouldEnableThinking('execution', 32768), true);
    });
  });

  describe('Scenario 4: Unlimited budget (0) - Always enable thinking', () => {
    it('should enable thinking for reasoning tasks with unlimited budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', 0);

      assert.strictEqual(result, true);
    });

    it('should enable thinking for execution tasks with unlimited budget', () => {
      const calculator = new BudgetCalculator();

      // FIXED: _parseBudget(0) now correctly returns 0 (unlimited)
      const result = calculator.shouldEnableThinking('execution', 0);

      // Unlimited budget should always enable thinking
      assert.strictEqual(result, true);
    });

    it('should enable thinking for mixed tasks with unlimited budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('mixed', 0);

      assert.strictEqual(result, true);
    });

    it('should parse unlimited from string "unlimited"', () => {
      const calculator = new BudgetCalculator();

      const budget = calculator._parseBudget('unlimited');

      assert.strictEqual(budget, 0);
    });

    it('should parse unlimited from string "UNLIMITED" (case insensitive)', () => {
      const calculator = new BudgetCalculator();

      const budget = calculator._parseBudget('UNLIMITED');

      assert.strictEqual(budget, 0);
    });

    it('should parse unlimited from number 0', () => {
      const calculator = new BudgetCalculator();

      // FIXED: _parseBudget(0) now correctly returns 0 (unlimited)
      const budget = calculator._parseBudget(0);

      // Should return 0 (unlimited)
      assert.strictEqual(budget, 0);
    });

    it('should describe unlimited budget correctly', () => {
      const calculator = new BudgetCalculator();

      const description = calculator.getBudgetDescription(0);

      assert.strictEqual(description, 'unlimited (always think)');
    });

    it('should treat negative numbers as unlimited', () => {
      const calculator = new BudgetCalculator();

      const budget1 = calculator._parseBudget(-1);
      const budget2 = calculator._parseBudget(-100);

      assert.strictEqual(budget1, 0);
      assert.strictEqual(budget2, 0);
      assert.strictEqual(calculator.shouldEnableThinking('execution', -1), true);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle medium budget boundaries (2049-8192)', () => {
      const calculator = new BudgetCalculator();

      // Just above low threshold
      assert.strictEqual(calculator.shouldEnableThinking('reasoning', 2049), true);
      assert.strictEqual(calculator.shouldEnableThinking('execution', 2049), false);

      // At medium threshold
      assert.strictEqual(calculator.shouldEnableThinking('reasoning', 8192), true);
      assert.strictEqual(calculator.shouldEnableThinking('execution', 8192), false);
    });

    it('should handle invalid budget strings gracefully', () => {
      const calculator = new BudgetCalculator();

      const budget1 = calculator._parseBudget('invalid');
      const budget2 = calculator._parseBudget('abc123');
      const budget3 = calculator._parseBudget('');

      assert.strictEqual(budget1, 8192); // Default
      assert.strictEqual(budget2, 8192); // Default
      assert.strictEqual(budget3, 8192); // Default
    });

    it('should handle custom default budget', () => {
      const calculator = new BudgetCalculator({ defaultBudget: 4096 });

      const budget = calculator._parseBudget(null);

      assert.strictEqual(budget, 4096);
    });

    it('should handle undefined task type as mixed', () => {
      const calculator = new BudgetCalculator();

      const result1 = calculator.shouldEnableThinking(undefined, 8192);
      const result2 = calculator.shouldEnableThinking(null, 8192);

      // Should default to safe mode (true for medium budget)
      assert.strictEqual(result1, true);
      assert.strictEqual(result2, true);
    });

    it('should handle number type budgets directly', () => {
      const calculator = new BudgetCalculator();

      const result1 = calculator.shouldEnableThinking('execution', 16384);
      const result2 = calculator.shouldEnableThinking('execution', 2048);

      assert.strictEqual(result1, true);  // High budget
      assert.strictEqual(result2, false); // Low budget
    });

    it('should describe all budget ranges correctly', () => {
      const calculator = new BudgetCalculator();

      assert.strictEqual(calculator.getBudgetDescription(0), 'unlimited (always think)');
      assert.strictEqual(calculator.getBudgetDescription(1024), 'low (fast execution, no thinking)');
      assert.strictEqual(calculator.getBudgetDescription(2048), 'low (fast execution, no thinking)');
      assert.strictEqual(calculator.getBudgetDescription(4096), 'medium (task-aware thinking)');
      assert.strictEqual(calculator.getBudgetDescription(8192), 'medium (task-aware thinking)');
      assert.strictEqual(calculator.getBudgetDescription(16384), 'high (always think)');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle planning task with default budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', process.env.CCS_GLMT_THINKING_BUDGET);

      assert.strictEqual(result, true);
    });

    it('should handle quick fix task with low budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('execution', 1024);

      assert.strictEqual(result, false);
    });

    it('should handle complex analysis with high budget', () => {
      const calculator = new BudgetCalculator();

      const result = calculator.shouldEnableThinking('reasoning', 32768);

      assert.strictEqual(result, true);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  const Mocha = require('mocha');
  const mocha = new Mocha({ reporter: 'spec' });
  mocha.suite.emit('pre-require', global, null, mocha);

  // Load this test file
  require(module.filename);

  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}
