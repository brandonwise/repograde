# repograde

CLI that audits repositories for best practices and gives them a letter grade (A-F) with actionable recommendations.

## Installation

```bash
npm install -g repograde
```

Or run directly with npx:

```bash
npx repograde
```

## Usage

```bash
# Audit current directory
repograde

# Audit specific directory
repograde ./my-project

# Output as JSON (for CI)
repograde --json

# Show all issues and recommendations
repograde --verbose
```

## Example Output

```
repograde - Repository Quality Audit
/path/to/my-project

Grade: B (82%)

Checks:
  README                 ████████░░ 80%
  License                ██████████ 100%
  .gitignore             ████████░░ 85%
  CI/CD                  ██████████ 100%
  Test Config            ███████░░░ 70%
  Linting                ████████░░ 85%
  TypeScript             ██████████ 100%
  package.json Quality   ████████░░ 80%
  CONTRIBUTING.md        ░░░░░░░░░░ 0% (optional)
  Security Policy        ░░░░░░░░░░ 0% (optional)
  EditorConfig           ████████░░ 85%

Issues (2):
  • No CONTRIBUTING.md found
  • No SECURITY.md found

Recommendations:
  → Add CONTRIBUTING.md with contribution guidelines
  → Add SECURITY.md with vulnerability reporting instructions
```

## Checks

| Check | Weight | What it checks |
|-------|--------|----------------|
| README | 15% | Presence, length, sections (installation, usage), code examples, badges |
| License | 10% | LICENSE file presence, recognized license text |
| .gitignore | 5% | Presence, common patterns (node_modules, .env, etc.) |
| CI/CD | 12% | GitHub Actions, GitLab CI, CircleCI, Travis, Jenkins, Azure Pipelines |
| Tests | 12% | Test directory, test framework config, test script in package.json |
| Linting | 10% | ESLint, Biome, Prettier, StandardJS configs; lint scripts |
| TypeScript | 8% | tsconfig.json presence and strictness settings |
| package.json | 10% | Fields: name, version, description, license, keywords, engines, scripts |
| CONTRIBUTING | 6% | CONTRIBUTING.md presence and content quality |
| Security | 7% | SECURITY.md presence with contact info |
| EditorConfig | 5% | .editorconfig presence and completeness |

## Grading Scale

| Grade | Score |
|-------|-------|
| A | 90-100% |
| B | 80-89% |
| C | 70-79% |
| D | 60-69% |
| F | <60% |

## CI Integration

Use JSON output for CI pipelines:

```yaml
- name: Check repository quality
  run: npx repograde --json > grade.json

- name: Fail if below B
  run: |
    GRADE=$(cat grade.json | jq -r '.grade')
    if [[ "$GRADE" =~ ^[CDF]$ ]]; then
      echo "Repository grade is $GRADE, expected B or higher"
      exit 1
    fi
```

The CLI exits with code 1 for F grades, making it easy to fail CI checks.

## API

```javascript
import { runAudit, getGrade, CHECKS } from 'repograde';

// Run audit on a directory
const results = runAudit('/path/to/repo');
console.log(results.grade);       // 'B'
console.log(results.percentage);  // 82
console.log(results.issues);      // ['No CONTRIBUTING.md found', ...]
console.log(results.checks);      // Detailed per-check results

// Get grade from score
getGrade(85); // 'B'
getGrade(55); // 'F'
```

## License

MIT
