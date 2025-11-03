---
name: ccs-delegation
description: Use this skill when the user invokes the `/ccs` command or requests delegating tasks to alternative models (GLM) for token optimization. This skill guides when and how to delegate commands to save primary model tokens.
---

# CCS Delegation

Intelligent task delegation to alternative AI models (GLM, etc.) for token optimization using the `/ccs` meta-command.

## Purpose

The `/ccs` command delegates simple tasks to alternative models while staying in the primary session, optimizing:
- **Token efficiency**: Save primary model tokens for complex work
- **Task-model matching**: Use appropriate model for each task
- **Cost optimization**: Route simple tasks to lower-cost models

## When to Invoke This Skill

Load this skill when:
- User explicitly invokes `/ccs [profile] /command [args]`
- User requests delegating tasks to alternative models
- User asks to use GLM for a task
- User requests token conservation strategies

## Decision Framework

### ✅ Delegate to Alternative Models

Recommend `/ccs` when:

**Simple, straightforward tasks**:
- Basic planning (CRUD operations, simple features)
- Straightforward code implementation
- Documentation writing
- Simple bug fixes
- Routine refactoring

**Token conservation scenarios**:
- Working on complex project, saving tokens for hard parts
- Rate limit approaching on primary model
- Cost-conscious development

**User explicitly requests**:
- "Use GLM for this"
- "Delegate to cheaper model"
- "Save tokens on this task"

### ❌ Keep in Primary Model

Don't recommend delegation when:

**Complex reasoning required**:
- Architecture decisions
- System design patterns
- Complex debugging (multiple files)
- Security-critical code review

**Context-dependent**:
- Needs current session context
- Requires back-and-forth interaction
- Builds on previous conversation

**Quality-critical**:
- Production-critical code
- Security implementations
- Performance-sensitive algorithms
- Public-facing API design

## Quick Decision Tree

```
Is task simple and straightforward?
    ↓ NO → Keep in current model
    ↓ YES
    ↓
Does task need deep context from current session?
    ↓ YES → Keep in current model
    ↓ NO
    ↓
Is task security or quality critical?
    ↓ YES → Keep in current model
    ↓ NO
    ↓
✅ RECOMMEND /ccs delegation
```

## Usage Patterns

### Pattern 1: Explicit Delegation Request

When user explicitly requests alternative model:

```
User: "Use GLM to plan the authentication feature"
Claude: "I'll delegate this planning task to GLM to conserve tokens."
<Invokes: /ccs glm /plan "design authentication feature">
```

### Pattern 2: Proactive Token Optimization

When task is clearly simple, proactively suggest:

```
User: "/plan add a simple CRUD endpoint for users"
Claude: "This is straightforward. I'll delegate to GLM to save tokens."
<Invokes: /ccs glm /plan "add CRUD endpoint for users">
```

### Pattern 3: Automatic Model Selection

For simple tasks without explicit profile request:

```
User: "/ccs /code 'implement the auth endpoints'"
Claude: "Delegating to GLM (default profile) for implementation."
<Invokes command with default glm profile>
```

## Profile Selection Guide

**GLM (glm profile)**:
- Simple coding tasks
- Basic planning
- Documentation
- Routine fixes
- Default choice for simple tasks


**Sonnet (son profile)**:
- Don't delegate—use directly
- Complex reasoning
- Architecture decisions
- Security-critical work

## Command Format

```bash
/ccs [profile] /command [args...]
```

**Examples**:
- `/ccs glm /plan "add user authentication"`
- `/ccs glm /ask "explain JWT tokens"`
- `/ccs /code "implement feature"` (defaults to glm)

## Error Handling

If `/ccs` invocation fails:
1. Check if CCS is properly configured: `ccs --version`
2. Verify profile exists in `~/.ccs/config.json`
3. Ensure command exists in `~/.ccs/commands/` or `.claude/commands/`
4. Suggest running command directly if delegation problematic

## Configuration Check

Guide user to verify CCS setup:

```bash
# Check CCS version
ccs --version

# View available profiles
cat ~/.ccs/config.json

# List available commands
ls ~/.ccs/commands/
```

## Integration Notes

- `/ccs` is a meta-command that orchestrates other slash commands
- Each delegation creates isolated subagent session
- Subagent automatically switches to specified CCS profile
- User-scope commands (`~/.ccs/commands/`) checked first
- Project-scope commands (`.claude/commands/`) as fallback

## Related Resources

- Command implementation: `~/.ccs/commands/ccs.md`
- Detailed patterns: `references/delegation-patterns.md`
- Setup guide: `tools/ccs/SETUP-DELEGATION.md`
- CCS Tool: `tools/ccs/README.md`
