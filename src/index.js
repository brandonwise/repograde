#!/usr/bin/env node
/**
 * repograde - Repository quality auditor
 * Audits repos for best practices and gives them a letter grade (A-F)
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

// Check configurations with weights
const CHECKS = [
  { id: 'readme', name: 'README', weight: 15, check: checkReadme },
  { id: 'license', name: 'License', weight: 10, check: checkLicense },
  { id: 'gitignore', name: '.gitignore', weight: 5, check: checkGitignore },
  { id: 'ci', name: 'CI/CD', weight: 12, check: checkCI },
  { id: 'tests', name: 'Test Config', weight: 12, check: checkTests },
  { id: 'linting', name: 'Linting', weight: 10, check: checkLinting },
  { id: 'typescript', name: 'TypeScript', weight: 8, check: checkTypeScript },
  { id: 'packagejson', name: 'package.json Quality', weight: 10, check: checkPackageJson },
  { id: 'contributing', name: 'CONTRIBUTING.md', weight: 6, check: checkContributing },
  { id: 'security', name: 'Security Policy', weight: 7, check: checkSecurity },
  { id: 'editorconfig', name: 'EditorConfig', weight: 5, check: checkEditorConfig },
];

/**
 * Find a file case-insensitively
 */
function findFile(dir, names) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  for (const name of Array.isArray(names) ? names : [names]) {
    const found = files.find(f => f.toLowerCase() === name.toLowerCase());
    if (found) return join(dir, found);
  }
  return null;
}

/**
 * Check if a path exists (file or directory)
 */
function pathExists(path) {
  return existsSync(path);
}

/**
 * Read file contents safely
 */
function readFileSafe(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check README quality
 */
function checkReadme(dir) {
  const readmePath = findFile(dir, ['readme.md', 'readme.txt', 'readme', 'readme.markdown', 'readme.rst']);
  if (!readmePath) {
    return { score: 0, max: 100, issues: ['No README file found'], recommendations: ['Create a README.md with project description, installation, and usage'] };
  }

  const content = readFileSafe(readmePath);
  if (!content) {
    return { score: 10, max: 100, issues: ['README exists but could not be read'], recommendations: [] };
  }

  let score = 20; // Base score for having a README
  const issues = [];
  const recommendations = [];

  // Check length
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 50) {
    issues.push('README is very short (<50 words)');
    recommendations.push('Expand README with more details about the project');
  } else if (wordCount < 150) {
    score += 10;
  } else if (wordCount < 500) {
    score += 20;
  } else {
    score += 25;
  }

  // Check for common sections
  const contentLower = content.toLowerCase();
  
  if (/^#{1,2}\s*(installation|install|getting started|setup)/mi.test(content)) {
    score += 15;
  } else {
    issues.push('No installation section');
    recommendations.push('Add an Installation or Getting Started section');
  }

  if (/^#{1,2}\s*(usage|how to use|examples?)/mi.test(content)) {
    score += 15;
  } else {
    issues.push('No usage section');
    recommendations.push('Add a Usage section with examples');
  }

  // Check for badges
  if (/\[!\[.*?\]\(.*?\)\]\(.*?\)/.test(content) || /!\[.*?\]\(.*?badge.*?\)/i.test(content)) {
    score += 5;
  }

  // Check for code blocks
  if (/```[\s\S]*?```/.test(content)) {
    score += 10;
  } else {
    recommendations.push('Add code examples in fenced code blocks');
  }

  // Check for links
  if (/\[.*?\]\(.*?\)/.test(content)) {
    score += 5;
  }

  // Cap at 100
  score = Math.min(score, 100);

  return { score, max: 100, issues, recommendations };
}

/**
 * Check for LICENSE file
 */
function checkLicense(dir) {
  const licensePath = findFile(dir, ['license', 'license.md', 'license.txt', 'licence', 'licence.md', 'copying']);
  
  if (!licensePath) {
    // Check package.json for license field
    const pkgPath = join(dir, 'package.json');
    if (pathExists(pkgPath)) {
      const pkg = JSON.parse(readFileSafe(pkgPath) || '{}');
      if (pkg.license) {
        return { score: 60, max: 100, issues: ['License specified in package.json but no LICENSE file'], recommendations: ['Create a LICENSE file with the full license text'] };
      }
    }
    return { score: 0, max: 100, issues: ['No LICENSE file found'], recommendations: ['Add a LICENSE file (MIT, Apache-2.0, etc.)'] };
  }

  const content = readFileSafe(licensePath);
  if (!content || content.length < 50) {
    return { score: 30, max: 100, issues: ['LICENSE file is empty or very short'], recommendations: ['Add the full license text'] };
  }

  // Check for common licenses
  const contentLower = content.toLowerCase();
  if (/mit license|permission is hereby granted/i.test(content)) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }
  if (/apache license|version 2\.0/i.test(content)) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }
  if (/gnu general public license|gpl/i.test(content)) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }
  if (/bsd/i.test(content)) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }

  return { score: 80, max: 100, issues: [], recommendations: [] };
}

/**
 * Check for .gitignore
 */
function checkGitignore(dir) {
  const gitignorePath = join(dir, '.gitignore');
  if (!pathExists(gitignorePath)) {
    return { score: 0, max: 100, issues: ['No .gitignore file'], recommendations: ['Create a .gitignore appropriate for your project'] };
  }

  const content = readFileSafe(gitignorePath);
  if (!content) {
    return { score: 20, max: 100, issues: ['.gitignore exists but is empty'], recommendations: ['Add ignore patterns for your project type'] };
  }

  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).length;
  
  if (lines < 3) {
    return { score: 40, max: 100, issues: ['.gitignore has very few entries'], recommendations: ['Add more ignore patterns (node_modules, build artifacts, etc.)'] };
  }

  let score = 70;
  const recommendations = [];

  // Check for common patterns based on project type
  const hasNodeModules = /node_modules/i.test(content);
  const hasBuild = /\bdist\b|\bbuild\b|\bout\b/i.test(content);
  const hasEnv = /\.env/i.test(content);
  const hasIDE = /\.idea|\.vscode|\.vs\b/i.test(content);

  if (hasNodeModules) score += 10;
  if (hasBuild) score += 5;
  if (hasEnv) score += 10;
  else recommendations.push('Consider adding .env to .gitignore');
  if (hasIDE) score += 5;

  return { score: Math.min(score, 100), max: 100, issues: [], recommendations };
}

/**
 * Check for CI/CD configuration
 */
function checkCI(dir) {
  const issues = [];
  const recommendations = [];
  
  // GitHub Actions
  const ghActionsDir = join(dir, '.github', 'workflows');
  if (pathExists(ghActionsDir)) {
    try {
      const workflows = readdirSync(ghActionsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      if (workflows.length > 0) {
        return { score: 100, max: 100, issues: [], recommendations: [] };
      }
    } catch {}
  }

  // GitLab CI
  if (pathExists(join(dir, '.gitlab-ci.yml'))) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }

  // CircleCI
  if (pathExists(join(dir, '.circleci', 'config.yml'))) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }

  // Travis CI
  if (pathExists(join(dir, '.travis.yml'))) {
    return { score: 80, max: 100, issues: ['Using Travis CI (consider GitHub Actions)'], recommendations: [] };
  }

  // Jenkins
  if (pathExists(join(dir, 'Jenkinsfile'))) {
    return { score: 90, max: 100, issues: [], recommendations: [] };
  }

  // Azure Pipelines
  if (pathExists(join(dir, 'azure-pipelines.yml'))) {
    return { score: 100, max: 100, issues: [], recommendations: [] };
  }

  return { score: 0, max: 100, issues: ['No CI/CD configuration found'], recommendations: ['Add GitHub Actions workflow for automated testing'] };
}

/**
 * Check for test configuration
 */
function checkTests(dir) {
  let score = 0;
  const issues = [];
  const recommendations = [];

  // Check for test directories
  const testDirs = ['test', 'tests', '__tests__', 'spec', 'specs'];
  const hasTestDir = testDirs.some(d => pathExists(join(dir, d)));
  
  if (hasTestDir) {
    score += 40;
  }

  // Check for test config files
  const testConfigs = [
    'jest.config.js', 'jest.config.ts', 'jest.config.mjs', 'jest.config.cjs', 'jest.config.json',
    'vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs',
    'mocha.opts', '.mocharc.js', '.mocharc.json', '.mocharc.yml',
    'karma.conf.js', 'karma.conf.ts',
    'ava.config.js', 'ava.config.cjs', 'ava.config.mjs',
    'playwright.config.js', 'playwright.config.ts',
    'cypress.config.js', 'cypress.config.ts', 'cypress.json',
    'pytest.ini', 'pyproject.toml', 'setup.cfg', 'tox.ini'
  ];

  const hasTestConfig = testConfigs.some(f => pathExists(join(dir, f)));
  if (hasTestConfig) {
    score += 30;
  }

  // Check package.json for test script
  const pkgPath = join(dir, 'package.json');
  if (pathExists(pkgPath)) {
    const pkg = JSON.parse(readFileSafe(pkgPath) || '{}');
    if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
      score += 30;
    } else {
      issues.push('No test script in package.json or using default placeholder');
      recommendations.push('Add a proper test script to package.json');
    }
  }

  if (score === 0) {
    issues.push('No test configuration found');
    recommendations.push('Set up a test framework (Jest, Vitest, Mocha, etc.)');
  }

  return { score: Math.min(score, 100), max: 100, issues, recommendations };
}

/**
 * Check for linting configuration
 */
function checkLinting(dir) {
  let score = 0;
  const issues = [];
  const recommendations = [];

  const lintConfigs = [
    // ESLint
    '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml',
    'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
    // Biome
    'biome.json', 'biome.jsonc',
    // Prettier
    '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yml', 'prettier.config.js',
    // StandardJS
    '.standardrc',
    // XO
    '.xo-config', '.xo-config.json',
    // Oxlint
    'oxlint.json', '.oxlintrc.json'
  ];

  const foundConfigs = lintConfigs.filter(f => pathExists(join(dir, f)));
  
  if (foundConfigs.length > 0) {
    score += 70;
    // Bonus for having both linter and formatter
    const hasLinter = foundConfigs.some(f => /eslint|biome|standard|xo|oxlint/i.test(f));
    const hasFormatter = foundConfigs.some(f => /prettier|biome/i.test(f));
    if (hasLinter && hasFormatter) {
      score += 30;
    } else if (hasLinter) {
      score += 15;
    }
  }

  // Check package.json for lint script
  const pkgPath = join(dir, 'package.json');
  if (pathExists(pkgPath)) {
    const pkg = JSON.parse(readFileSafe(pkgPath) || '{}');
    const hasLintScript = Object.keys(pkg.scripts || {}).some(s => /lint|eslint|biome/i.test(s));
    if (hasLintScript) {
      score += 15;
    }
    
    // Check for eslint in devDeps
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps.eslint || deps.biome || deps['@biomejs/biome'] || deps.oxlint) {
      score += 10;
    }
  }

  if (score === 0) {
    issues.push('No linting configuration found');
    recommendations.push('Add ESLint, Biome, or another linter');
  }

  return { score: Math.min(score, 100), max: 100, issues, recommendations };
}

/**
 * Check TypeScript configuration
 */
function checkTypeScript(dir) {
  const tsconfigPath = join(dir, 'tsconfig.json');
  const jsconfigPath = join(dir, 'jsconfig.json');
  
  if (!pathExists(tsconfigPath)) {
    // Check if project uses TypeScript
    const pkgPath = join(dir, 'package.json');
    if (pathExists(pkgPath)) {
      const pkg = JSON.parse(readFileSafe(pkgPath) || '{}');
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.typescript) {
        return { score: 20, max: 100, issues: ['TypeScript installed but no tsconfig.json'], recommendations: ['Create tsconfig.json with npx tsc --init'] };
      }
    }
    
    // Check for jsconfig as alternative
    if (pathExists(jsconfigPath)) {
      return { score: 60, max: 100, issues: [], recommendations: ['Consider migrating to TypeScript'] };
    }
    
    // Not a TypeScript project - give partial credit or skip
    return { score: 50, max: 100, issues: [], recommendations: ['Consider adding TypeScript for better type safety'], optional: true };
  }

  const content = readFileSafe(tsconfigPath);
  if (!content) {
    return { score: 30, max: 100, issues: ['tsconfig.json exists but could not be read'], recommendations: [] };
  }

  let score = 50;
  const issues = [];
  const recommendations = [];

  try {
    // Remove comments for parsing (basic approach)
    const jsonContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(jsonContent);
    const opts = config.compilerOptions || {};

    // Check for strict mode
    if (opts.strict === true) {
      score += 25;
    } else {
      issues.push('strict mode not enabled');
      recommendations.push('Enable "strict": true in tsconfig.json');
    }

    // Check for good practices
    if (opts.noImplicitAny || opts.strict) score += 5;
    if (opts.strictNullChecks || opts.strict) score += 5;
    if (opts.noUnusedLocals) score += 5;
    if (opts.noUnusedParameters) score += 5;
    if (opts.esModuleInterop) score += 5;

  } catch {
    issues.push('Could not parse tsconfig.json');
  }

  return { score: Math.min(score, 100), max: 100, issues, recommendations };
}

/**
 * Check package.json quality
 */
function checkPackageJson(dir) {
  const pkgPath = join(dir, 'package.json');
  if (!pathExists(pkgPath)) {
    // Check for other package managers
    if (pathExists(join(dir, 'Cargo.toml')) || pathExists(join(dir, 'go.mod')) || pathExists(join(dir, 'pyproject.toml'))) {
      return { score: 70, max: 100, issues: [], recommendations: [], optional: true };
    }
    return { score: 0, max: 100, issues: ['No package.json found'], recommendations: ['Initialize with npm init'] };
  }

  const content = readFileSafe(pkgPath);
  if (!content) {
    return { score: 10, max: 100, issues: ['package.json exists but could not be read'], recommendations: [] };
  }

  let score = 20;
  const issues = [];
  const recommendations = [];

  try {
    const pkg = JSON.parse(content);

    // Basic fields
    if (pkg.name) score += 5;
    else issues.push('Missing name field');

    if (pkg.version) score += 5;
    else issues.push('Missing version field');

    if (pkg.description && pkg.description.length > 10) score += 10;
    else recommendations.push('Add a meaningful description');

    // Repository
    if (pkg.repository) score += 10;
    else recommendations.push('Add repository field');

    // License
    if (pkg.license) score += 10;
    else {
      issues.push('Missing license field');
      recommendations.push('Add license field');
    }

    // Keywords
    if (pkg.keywords && pkg.keywords.length > 0) score += 5;
    else recommendations.push('Add keywords for discoverability');

    // Author
    if (pkg.author) score += 5;

    // Engines
    if (pkg.engines?.node) score += 10;
    else recommendations.push('Specify required Node.js version in engines.node');

    // Scripts
    if (pkg.scripts) {
      const scripts = Object.keys(pkg.scripts);
      if (scripts.includes('test')) score += 5;
      if (scripts.includes('build') || scripts.includes('compile')) score += 5;
      if (scripts.includes('lint') || scripts.some(s => s.includes('lint'))) score += 5;
    }

    // Files or main/exports
    if (pkg.files || pkg.main || pkg.exports) score += 5;

  } catch {
    issues.push('Invalid JSON in package.json');
    return { score: 5, max: 100, issues, recommendations: ['Fix JSON syntax errors'] };
  }

  return { score: Math.min(score, 100), max: 100, issues, recommendations };
}

/**
 * Check for CONTRIBUTING.md
 */
function checkContributing(dir) {
  const contributingPath = findFile(dir, ['contributing.md', 'contributing.txt', 'contributing']);
  
  // Also check in .github
  const ghContributing = findFile(join(dir, '.github'), ['contributing.md']);
  
  if (!contributingPath && !ghContributing) {
    return { score: 0, max: 100, issues: ['No CONTRIBUTING.md found'], recommendations: ['Add CONTRIBUTING.md with contribution guidelines'], optional: true };
  }

  const path = contributingPath || ghContributing;
  const content = readFileSafe(path);
  
  if (!content || content.length < 100) {
    return { score: 30, max: 100, issues: ['CONTRIBUTING.md is too short'], recommendations: ['Expand contribution guidelines'] };
  }

  let score = 60;
  
  // Check for common sections
  if (/pull request|pr/i.test(content)) score += 15;
  if (/code of conduct|coc/i.test(content)) score += 10;
  if (/issue|bug|feature/i.test(content)) score += 10;
  if (/style|format|lint/i.test(content)) score += 5;

  return { score: Math.min(score, 100), max: 100, issues: [], recommendations: [] };
}

/**
 * Check for security policy
 */
function checkSecurity(dir) {
  const securityPath = findFile(dir, ['security.md', 'security.txt', 'security']);
  const ghSecurity = findFile(join(dir, '.github'), ['security.md']);
  
  if (!securityPath && !ghSecurity) {
    return { score: 0, max: 100, issues: ['No SECURITY.md found'], recommendations: ['Add SECURITY.md with vulnerability reporting instructions'], optional: true };
  }

  const path = securityPath || ghSecurity;
  const content = readFileSafe(path);
  
  if (!content || content.length < 50) {
    return { score: 30, max: 100, issues: ['SECURITY.md is too short'], recommendations: ['Add detailed vulnerability reporting process'] };
  }

  let score = 70;
  
  if (/vulnerabilit|report|disclose/i.test(content)) score += 15;
  if (/email|contact/i.test(content)) score += 15;

  return { score: Math.min(score, 100), max: 100, issues: [], recommendations: [] };
}

/**
 * Check for EditorConfig
 */
function checkEditorConfig(dir) {
  const editorConfigPath = join(dir, '.editorconfig');
  
  if (!pathExists(editorConfigPath)) {
    return { score: 0, max: 100, issues: ['No .editorconfig found'], recommendations: ['Add .editorconfig for consistent formatting across editors'], optional: true };
  }

  const content = readFileSafe(editorConfigPath);
  if (!content) {
    return { score: 30, max: 100, issues: ['.editorconfig exists but is empty'], recommendations: [] };
  }

  let score = 70;
  
  if (/root\s*=\s*true/i.test(content)) score += 10;
  if (/indent_style/i.test(content)) score += 10;
  if (/end_of_line/i.test(content)) score += 5;
  if (/charset/i.test(content)) score += 5;

  return { score: Math.min(score, 100), max: 100, issues: [], recommendations: [] };
}

/**
 * Calculate letter grade from score
 */
function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get grade color for terminal
 */
function getGradeColor(grade) {
  const colors = {
    A: '\x1b[32m',  // Green
    B: '\x1b[36m',  // Cyan
    C: '\x1b[33m',  // Yellow
    D: '\x1b[35m',  // Magenta
    F: '\x1b[31m',  // Red
  };
  return colors[grade] || '';
}

/**
 * Run all checks and return results
 */
function runAudit(dir) {
  const results = {
    directory: dir,
    checks: [],
    totalScore: 0,
    maxScore: 0,
    grade: 'F',
    issues: [],
    recommendations: [],
  };

  for (const checkDef of CHECKS) {
    const result = checkDef.check(dir);
    const weightedScore = (result.score / result.max) * checkDef.weight;
    
    results.checks.push({
      id: checkDef.id,
      name: checkDef.name,
      score: result.score,
      maxScore: result.max,
      weight: checkDef.weight,
      weightedScore: Math.round(weightedScore * 10) / 10,
      issues: result.issues,
      recommendations: result.recommendations,
      optional: result.optional || false,
    });

    results.totalScore += weightedScore;
    results.maxScore += checkDef.weight;
    results.issues.push(...result.issues);
    results.recommendations.push(...result.recommendations);
  }

  // Normalize to percentage
  results.percentage = Math.round((results.totalScore / results.maxScore) * 100);
  results.grade = getGrade(results.percentage);

  return results;
}

/**
 * Format results for terminal output
 */
function formatResults(results, verbose = false) {
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const gradeColor = getGradeColor(results.grade);
  
  let output = '\n';
  output += `${bold}repograde${reset} - Repository Quality Audit\n`;
  output += `${dim}${results.directory}${reset}\n\n`;
  
  // Grade display
  output += `${bold}Grade: ${gradeColor}${results.grade}${reset} ${dim}(${results.percentage}%)${reset}\n\n`;

  // Checks breakdown
  output += `${bold}Checks:${reset}\n`;
  for (const check of results.checks) {
    const pct = Math.round((check.score / check.maxScore) * 100);
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
    const checkGrade = getGrade(pct);
    const checkColor = getGradeColor(checkGrade);
    const optional = check.optional ? ` ${dim}(optional)${reset}` : '';
    output += `  ${check.name.padEnd(22)} ${bar} ${checkColor}${pct}%${reset}${optional}\n`;
    
    if (verbose && check.issues.length > 0) {
      for (const issue of check.issues) {
        output += `    ${dim}⚠ ${issue}${reset}\n`;
      }
    }
  }

  // Issues summary
  if (results.issues.length > 0) {
    output += `\n${bold}Issues (${results.issues.length}):${reset}\n`;
    const uniqueIssues = [...new Set(results.issues)];
    for (const issue of uniqueIssues.slice(0, verbose ? undefined : 5)) {
      output += `  • ${issue}\n`;
    }
    if (!verbose && uniqueIssues.length > 5) {
      output += `  ${dim}... and ${uniqueIssues.length - 5} more (use --verbose)${reset}\n`;
    }
  }

  // Recommendations
  if (results.recommendations.length > 0) {
    output += `\n${bold}Recommendations:${reset}\n`;
    const uniqueRecs = [...new Set(results.recommendations)];
    for (const rec of uniqueRecs.slice(0, verbose ? undefined : 5)) {
      output += `  → ${rec}\n`;
    }
    if (!verbose && uniqueRecs.length > 5) {
      output += `  ${dim}... and ${uniqueRecs.length - 5} more (use --verbose)${reset}\n`;
    }
  }

  output += '\n';
  return output;
}

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const options = {
    dir: '.',
    json: false,
    verbose: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-v' || arg === '--version') {
      options.version = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (!arg.startsWith('-')) {
      options.dir = arg;
    }
  }

  return options;
}

/**
 * Print help
 */
function printHelp() {
  console.log(`
repograde - Repository Quality Auditor

USAGE:
  repograde [directory] [options]

ARGUMENTS:
  directory     Path to repository (default: current directory)

OPTIONS:
  --json        Output results as JSON
  --verbose     Show detailed issues and recommendations
  -h, --help    Show this help message
  -v, --version Show version

EXAMPLES:
  repograde                    Audit current directory
  repograde ./my-project       Audit specific directory
  repograde --json             Output JSON for CI integration
  repograde --verbose          Show all issues and recommendations

CHECKS:
  README          README presence and quality
  License         LICENSE file presence
  .gitignore      Ignore file presence and quality
  CI/CD           CI configuration (GitHub Actions, etc.)
  Tests           Test framework configuration
  Linting         Linter/formatter configuration
  TypeScript      TypeScript configuration quality
  package.json    Package metadata completeness
  CONTRIBUTING    Contribution guidelines
  Security        Security policy presence
  EditorConfig    Editor configuration

GRADING:
  A: 90-100%    B: 80-89%    C: 70-79%    D: 60-69%    F: <60%
`);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log('1.0.0');
    process.exit(0);
  }

  const dir = resolve(options.dir);
  
  if (!existsSync(dir)) {
    console.error(`Error: Directory not found: ${dir}`);
    process.exit(1);
  }

  if (!statSync(dir).isDirectory()) {
    console.error(`Error: Not a directory: ${dir}`);
    process.exit(1);
  }

  const results = runAudit(dir);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(formatResults(results, options.verbose));
  }

  // Exit with non-zero for failing grades in CI
  if (results.grade === 'F') {
    process.exit(1);
  }
}

// Export for testing
export { runAudit, formatResults, CHECKS, getGrade };

// Run if called directly (not imported as module)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
