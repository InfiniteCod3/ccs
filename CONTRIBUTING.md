# CCS Contributing Guide

Welcome! We're excited you're interested in contributing to CCS. This guide will help you get started.

## 🚀 Quick Start for First-Time Contributors

**Never contributed before?** Start here:

1. **Find a good first issue**: Look for issues labeled [`good first issue`](https://github.com/kaitranntt/ccs/labels/good%20first%20issue)
2. **Read [CLAUDE.md](./CLAUDE.md)**: Understand the project architecture and v3.0 features
3. **Set up your environment**: See [Development Setup](#development-setup) below
4. **Make a small change**: Fix a typo, improve docs, or tackle a small bug
5. **Submit a PR**: We'll guide you through the review process

**Questions?** Open a [GitHub Discussion](https://github.com/kaitranntt/ccs/discussions) - we're here to help!

## Development Guidelines

### Philosophy

CCS follows these core principles:

- **YAGNI**: No features "just in case"
- **KISS**: Simple bash, no complexity
- **DRY**: One source of truth (config)

This tool does ONE thing well: enable instant switching between Claude accounts and alternative models.

### Code Standards

#### Compatibility Requirements

- **Unix**: bash 3.2+ compatibility
- **Windows**: PowerShell 5.1+ compatibility
- **Node.js**: Node.js 14+ (for npm package)
- **Dependencies**: Only jq (Unix) or built-in PowerShell (Windows)

#### Code Style

**Bash (Unix)**:
- Use `#!/usr/bin/env bash` shebang
- Quote variables: `"$VAR"` not `$VAR`
- Use `[[ ]]` for tests, not `[ ]`
- Follow existing indentation and naming patterns

**PowerShell (Windows)**:
- Use `CmdletBinding` and proper parameter handling
- Follow PowerShell verb-noun convention
- Use proper error handling with `try/catch`
- Maintain compatibility with PowerShell 5.1+

**Node.js (npm package)**:
- Use `child_process.spawn` for Claude CLI execution
- Handle SIGINT/SIGTERM for graceful shutdown
- Cross-platform path handling with `path` module
- ES modules preferred

### Testing

#### Platform Testing

Test on all platforms before submitting PR:
- macOS (bash)
- Linux (bash)
- Windows (PowerShell, CMD, Git Bash)

#### Test Scenarios

1. **Basic functionality**:
   ```bash
   ccs            # Should use default profile
   ccs glm        # Should use GLM profile
   ccs kimi       # Should use Kimi profile
   ccs --version  # Should show version
   ```

2. **v3.0 account-based profiles**:
   ```bash
   ccs auth create work     # Should open Claude for login
   ccs work "test"          # Should use work profile
   # Run in different terminal concurrently:
   ccs personal "test"      # Should use personal profile
   ```

3. **With arguments**:
   ```bash
   ccs glm --help
   ccs /plan "test"
   ```

4. **Error handling**:
   ```bash
   ccs invalid-profile    # Should show error
   ccs --invalid-flag     # Should pass through to Claude
   ```

### Submission Process

#### Before Submitting

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test on all platforms
5. Ensure existing tests pass

#### Pull Request Requirements

- Clear description of changes
- Testing instructions if applicable
- Link to relevant issues
- Follow existing commit message style

#### Commit Message Style

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
```
fix(installer): handle git worktree detection
feat(config): support custom config location
docs(readme): update installation instructions
```

### Development Setup

#### Local Development

```bash
# Clone your fork
git clone https://github.com/yourusername/ccs.git
cd ccs

# Create feature branch
git checkout -b your-feature-name

# Make changes
# Test locally with ./ccs

# Run tests
bun run test           # All tests
bun run test:native    # Native Unix tests only
```

#### Testing npm Package Locally

```bash
# Build and test npm package
npm pack                              # Creates @kaitranntt-ccs-X.Y.Z.tgz
npm install -g @kaitranntt-ccs-X.Y.Z.tgz  # Test installation
ccs --version                         # Verify it works
ccs glm "test"                        # Test functionality

# Cleanup
npm uninstall -g @kaitranntt/ccs
rm @kaitranntt-ccs-X.Y.Z.tgz
rm -rf ~/.ccs  # Clean test environment
```

#### Testing Installer

```bash
# Test Unix installer
./installers/install.sh

# Test Windows installer (in PowerShell)
.\installers\install.ps1
```

### Areas for Contribution

**Looking for where to start?** Check [GitHub Issues](https://github.com/kaitranntt/ccs/issues) for:
- [`good first issue`](https://github.com/kaitranntt/ccs/labels/good%20first%20issue) - Great for first-time contributors
- [`help wanted`](https://github.com/kaitranntt/ccs/labels/help%20wanted) - We need your expertise!
- [`documentation`](https://github.com/kaitranntt/ccs/labels/documentation) - Improve our docs

#### Priority Areas

1. **v3.0 Enhancements**:
   - Profile management commands
   - Better instance isolation
   - Profile import/export

2. **Enhanced error handling**:
   - Better error messages
   - Recovery suggestions
   - Helpful Claude CLI detection

3. **Documentation**:
   - More usage examples
   - Integration guides
   - Video tutorials

4. **Testing**:
   - Expand test coverage
   - Add CI/CD tests
   - Performance benchmarks

#### Bug Fixes

- Installer issues on different platforms
- Edge cases in config parsing
- Windows-specific compatibility
- v3.0 concurrent session edge cases

### Review Process

**What to expect:**

1. **Automated checks** (GitHub Actions):
   - Syntax validation
   - Basic functionality tests
   - npm package build test

2. **Manual review** (usually within 1-3 days):
   - Code quality and style
   - Platform compatibility
   - Philosophy alignment (YAGNI/KISS/DRY)

3. **Testing** (by maintainers):
   - Cross-platform verification (macOS, Linux, Windows)
   - Integration testing
   - v3.0 features validation

**Tips for faster review:**
- Keep PRs focused and small
- Include tests for new features
- Test on multiple platforms before submitting
- Link to related issues

### Community

#### Getting Help

- **GitHub Issues**: Report bugs or request features
- **Discussions**: Ask questions or share ideas
- **README**: Check [README.md](./README.md) for usage examples

#### Communication Channels

- Primary: [GitHub Issues](https://github.com/kaitranntt/ccs/issues)
- Questions: [GitHub Discussions](https://github.com/kaitranntt/ccs/discussions)
- Updates: Watch the repository for release notifications

#### Code of Conduct

Be respectful, constructive, and focused on the project's philosophy of simplicity and reliability.

**We do not tolerate:**
- Harassment or discrimination
- Spam or off-topic comments
- Disrespectful or unprofessional behavior

**We encourage:**
- Helpful feedback and constructive criticism
- Collaboration and knowledge sharing
- Patience with newcomers

## 📚 Additional Resources

- **[CLAUDE.md](./CLAUDE.md)**: Technical architecture and v3.0 implementation details
- **[README.md](./README.md)**: User-facing documentation and examples
- **[GitHub Issues](https://github.com/kaitranntt/ccs/issues)**: Track bugs, features, and discussions
- **[VERSION](./VERSION)**: Current version number

## 🎯 Release Process

**For maintainers:**

1. Bump version: `./scripts/bump-version.sh [major|minor|patch]`
2. Update CHANGELOG if applicable
3. Commit: `git commit -m "chore: bump version to X.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push origin main && git push origin vX.Y.Z`
6. GitHub Actions will automatically publish to npm

## 📄 License

By contributing to CCS, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to CCS!**

Remember: Keep it simple, test thoroughly, and stay true to the YAGNI/KISS/DRY philosophy.