# CCS Delegation Patterns - Detailed Reference

This reference provides comprehensive patterns and examples for CCS task delegation.

## Advanced Usage Patterns

### Pattern 4: Task Splitting (Complex + Simple)

Split work between models for optimal efficiency:

```
User: "Design and implement payment system"

Claude (in Sonnet):
1. Design architecture (Sonnet handles complex reasoning)
   - Security considerations
   - Data flow diagrams
   - API contracts

2. Delegate implementation to GLM:
   /ccs glm /code "implement payment webhook handler based on this design"

3. Review security (back to Sonnet):
   Review the implemented code for security vulnerabilities
```

### Pattern 5: Batch Operations

Delegate multiple simple tasks sequentially:

```bash
# Multiple planning tasks
/ccs glm /plan "feature A: user profile"
/ccs glm /plan "feature B: notifications"
/ccs glm /plan "feature C: search functionality"

# Then review all plans together in Sonnet
"Review all three plans for consistency and integration points"
```

### Pattern 6: Iterative Refinement

Use GLM for initial implementation, Sonnet for refinement:

```
1. /ccs glm /code "implement basic CRUD API"
2. (Sonnet reviews): "Add error handling, input validation, rate limiting"
3. /ccs glm /fix "add suggested improvements"
```

## Model Capability Matrix

### GLM 4.6 - Best For:
- ✅ Simple feature planning (CRUD, basic workflows)
- ✅ Straightforward code implementation
- ✅ Documentation and README files
- ✅ Basic bug fixes (clear error messages)
- ✅ Refactoring with clear scope
- ✅ Test writing (unit tests, simple integration tests)
- ✅ Configuration files (package.json, tsconfig, etc.)
- ❌ Complex algorithms
- ❌ Security-critical code
- ❌ Performance optimization
- ❌ Architecture decisions


### Sonnet 4.5 - Best For:
- ✅ Complex architecture and design
- ✅ Security-critical code review
- ✅ Performance optimization
- ✅ Complex debugging (multiple files, unclear root cause)
- ✅ API design and contracts
- ✅ Database schema design
- ✅ Integration planning
- ✅ Ambiguous requirement clarification

## Context Preservation Strategies

### When Delegation Makes Sense

**Low context requirements**:
```
# Current session has 50 lines discussing feature X
# User wants to add unrelated feature Y
/ccs glm /plan "add feature Y"  # ✅ Good - Y doesn't need X's context
```

**Self-contained tasks**:
```
# Task has all info in the prompt
/ccs glm /code "implement function that validates email addresses"  # ✅ Good
```

### When to Keep in Current Session

**High context dependency**:
```
# Current session has extensive discussion about auth flow
# User: "now implement the login function"
# ❌ Don't delegate - needs current context
```

**Iterative refinement**:
```
# Session has 10 messages refining a complex algorithm
# User: "adjust the algorithm to handle edge case X"
# ❌ Don't delegate - needs full conversation history
```

## Token Efficiency Analysis

### Token Savings Example

**Without delegation**:
- Complex architecture discussion: 15,000 tokens (Sonnet)
- Simple implementation: 5,000 tokens (Sonnet)
- Total: 20,000 Sonnet tokens

**With delegation**:
- Complex architecture discussion: 15,000 tokens (Sonnet)
- Delegate implementation: 5,000 tokens (GLM)
- Total: 15,000 Sonnet + 5,000 GLM tokens
- **Savings**: 5,000 Sonnet tokens

### When Delegation Overhead Outweighs Benefits

**Very simple tasks** (< 200 tokens):
```
User: "add a comment to this line"
# ❌ Don't delegate - overhead > benefit
```

**Tasks needing immediate context** (recent discussion):
```
User: "based on what we just discussed, implement X"
# ❌ Don't delegate - needs immediate context
```

## Real-World Workflows

### Workflow 1: New Feature Development

```
1. Requirements gathering (Sonnet)
   - Clarify ambiguous requirements
   - Discuss trade-offs
   - Design API contracts

2. Planning (GLM)
   /ccs glm /plan "implement user profile feature based on requirements"

3. Implementation (GLM)
   /ccs glm /code "implement the user profile API endpoints"

4. Review (Sonnet)
   - Security review
   - Performance check
   - Integration verification

5. Fixes (GLM if simple, Sonnet if complex)
   /ccs glm /fix "address code review comments"
```

### Workflow 2: Bug Investigation & Fix

```
1. Investigation (Sonnet)
   - Analyze logs
   - Trace root cause
   - Understand system state

2. Simple fix (GLM)
   /ccs glm /fix "update validation in UserController to handle null emails"

3. Verification (Sonnet)
   - Verify fix addresses root cause
   - Check for regressions
```

### Workflow 3: Documentation Sprint

```
1. /ccs glm /docs "document the authentication API endpoints"
2. /ccs glm /docs "write setup guide for new developers"
3. /ccs glm /docs "create API usage examples"
4. (Sonnet reviews for completeness and accuracy)
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Over-Delegation

❌ **Bad**:
```
/ccs glm /plan "design entire microservices architecture"
# Too complex for GLM
```

✅ **Good**:
```
# Sonnet handles architecture
# Then: /ccs glm /code "implement user service based on architecture"
```

### Anti-Pattern 2: Delegation with Hidden Context

❌ **Bad**:
```
# After 20 messages discussing custom auth flow
User: "implement the login"
/ccs glm /code "implement login"
# GLM doesn't have context about custom flow
```

✅ **Good**:
```
# Include context in delegation
/ccs glm /code "implement login using JWT with custom claims: userId, role, tenantId"
```

### Anti-Pattern 3: Micro-Delegation

❌ **Bad**:
```
/ccs glm /code "add variable x"
/ccs glm /code "add function y"
/ccs glm /code "add class z"
# Too much delegation overhead
```

✅ **Good**:
```
/ccs glm /code "implement user management module with CRUD operations"
```

## Troubleshooting

### Issue: Delegated Task Failed

**Symptoms**:
- GLM produces incorrect code
- Implementation doesn't match requirements
- Security vulnerabilities introduced

**Solutions**:
1. Check if task was too complex for GLM
2. Provide more explicit requirements
3. Use Sonnet for complex parts, GLM only for straightforward implementation
4. Review GLM output in Sonnet before accepting

### Issue: Context Loss

**Symptoms**:
- Delegated task doesn't align with previous discussion
- Implementation misses important constraints
- Style doesn't match existing codebase

**Solutions**:
1. Include more context in delegation prompt
2. Don't delegate context-dependent tasks
3. Provide explicit style guidelines in prompt
4. Consider keeping task in current session

### Issue: Frequent Delegation Failures

**Symptoms**:
- Multiple retries needed
- Tasks keep failing validation
- Time spent > time saved

**Solutions**:
1. Re-evaluate task complexity
2. Delegate fewer, larger tasks instead of many small ones
3. Use more specific instructions
4. Consider if delegation is appropriate for this workflow

## Best Practices Summary

1. **Delegate simple, self-contained tasks**
2. **Keep complex reasoning in Sonnet**
3. **Include sufficient context in delegation**
4. **Review delegated output before proceeding**
5. **Monitor token savings vs overhead**
6. **Prefer batch operations over micro-delegations**
7. **Document delegation patterns that work well**
8. **Iterate on delegation strategies based on results**
