---
allowed-tools: Glob, Read, Bash(jq:*), Task
description: Delegate commands to alternative models (GLM) for token optimization
argument-hint: [profile] /command [args...]
model: sonnet
---

# /ccs - Delegate to Alternative Models

You are a **delegation orchestrator**. Your job is to delegate the user's command to an alternative AI model (GLM, etc.) using the CCS (Claude Code Switch) system.

## User's Input

The user invoked: `/ccs {{args}}`

## Your Task

Follow these steps to delegate the command:

### Step 1: Parse Arguments

Extract from the user's input:
- **Profile**: Model profile to use (e.g., `glm`, `son`) - defaults to `glm` if omitted
- **Command**: The slash command to delegate (e.g., `plan`, `code`, `debug`)
- **Arguments**: Additional arguments to pass to the command

**Examples**:
- `/ccs glm /plan "add auth"` → profile=`glm`, command=`plan`, args=`"add auth"`
- `/ccs /code "fix bug"` → profile=`glm` (default), command=`code`, args=`"fix bug"`
- `/ccs glm /ask "what is X?"` → profile=`glm`, command=`ask`, args=`"what is X?"`

### Step 2: Validate Profile

Check if the profile exists in `~/.ccs/config.json`:

```bash
jq -e '.profiles["<profile>"]' ~/.ccs/config.json
```

If the profile doesn't exist:
```
❌ Error: Profile '<profile>' not found in ~/.ccs/config.json

Available profiles:
<list profiles from config>

Usage: /ccs [profile] /command [args]
Example: /ccs glm /plan "add authentication"
```

### Step 3: Validate Command

The command will be executed in the launched Claude instance, which will look for `<command>.md` in the project's `.claude/commands/` directory.

**Note**: If the command doesn't exist in the target project, the Claude instance will fail with an appropriate error message.

### Step 4: Launch Subagent with Task Tool

Use the Task tool to delegate execution:

**Parameters**:
```typescript
{
  subagent_type: "general-purpose",
  model: "sonnet",
  description: "Delegating /<command> to <profile> profile",
  prompt: `You are executing a delegated command via CCS (Claude Code Switch).

**Delegation Context**:
- Profile: <profile>
- Command: /<command>
- Arguments: <args>

**CRITICAL**: Before executing, switch to the CCS profile:
\`\`\`bash
ccs <profile>
\`\`\`

**Instructions**:
1. Run \`ccs <profile>\` to switch to the correct model
2. Execute the command with arguments: <args>
3. Provide a clear summary of what was accomplished

Execute now.`
}
```

### Step 5: Format and Return Result

Present the subagent's output in this format:

```markdown
🤖 **CCS Delegation Result**

**Profile**: <profile>
**Command**: /<command>

---

<subagent-output>

---

💡 *Token optimization: This task was delegated to the '<profile>' profile to conserve primary model usage.*
```

## When to Use /ccs

### ✅ Good Use Cases
- Simple planning tasks
- Straightforward code implementation
- Documentation writing
- Basic debugging
- Quick questions

### ❌ Don't Delegate
- Complex reasoning/architecture
- Security-critical code
- Deep code review
- Context-dependent tasks
- Already using right model

## Error Handling

If delegation fails, provide helpful error message with:
1. What went wrong
2. Suggestions to fix (try different profile, run directly, check CCS config)
3. How to verify CCS setup (`ccs --version`)

## Configuration Check

If profile validation fails, show how to check config:
```bash
# View available profiles
cat ~/.ccs/config.json

# Test CCS is working
ccs --version
```

## Examples

**Example 1**: Simple planning with GLM
```
User: /ccs glm /plan "add user authentication"
You: Parse → profile=glm, command=plan, args="add user authentication"
     Validate → Check glm exists in config ✓
     Launch → Task tool with ccs glm
     Return → Formatted result
```

**Example 2**: Quick question with GLM
```
User: /ccs glm /ask "explain JWT tokens"
You: Parse → profile=glm, command=ask, args="explain JWT tokens"
     Validate → Check glm exists ✓
     Launch → Delegate to glm
     Return → Result
```

**Example 3**: Default profile
```
User: /ccs /debug "API 500 error"
You: Parse → profile=glm (default), command=debug, args="API 500 error"
     Continue with delegation...
```

## Notes

- This is a **meta-command** that orchestrates other commands
- Each delegation creates an **isolated subagent session**
- The subagent switches to the specified CCS profile automatically
- **Token optimization** is the primary benefit
- Commands are resolved by the launched Claude instance from the project's `.claude/commands/` directory
- If a command doesn't exist, the Claude instance will fail with an error

## Related Documentation

- Delegation patterns: `tools/ccs/skills/ccs-delegation.md`
- CCS Tool: `tools/ccs/README.md`
