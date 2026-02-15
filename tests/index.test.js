import { test, describe } from 'node:test';
import assert from 'node:assert';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit, getGrade, CHECKS } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');

describe('repograde', () => {
  describe('getGrade', () => {
    test('returns A for 90+', () => {
      assert.strictEqual(getGrade(90), 'A');
      assert.strictEqual(getGrade(95), 'A');
      assert.strictEqual(getGrade(100), 'A');
    });

    test('returns B for 80-89', () => {
      assert.strictEqual(getGrade(80), 'B');
      assert.strictEqual(getGrade(85), 'B');
      assert.strictEqual(getGrade(89), 'B');
    });

    test('returns C for 70-79', () => {
      assert.strictEqual(getGrade(70), 'C');
      assert.strictEqual(getGrade(75), 'C');
      assert.strictEqual(getGrade(79), 'C');
    });

    test('returns D for 60-69', () => {
      assert.strictEqual(getGrade(60), 'D');
      assert.strictEqual(getGrade(65), 'D');
      assert.strictEqual(getGrade(69), 'D');
    });

    test('returns F for below 60', () => {
      assert.strictEqual(getGrade(59), 'F');
      assert.strictEqual(getGrade(0), 'F');
      assert.strictEqual(getGrade(30), 'F');
    });
  });

  describe('CHECKS', () => {
    test('has expected number of checks', () => {
      assert.ok(CHECKS.length >= 10, 'Should have at least 10 checks');
    });

    test('each check has required properties', () => {
      for (const check of CHECKS) {
        assert.ok(check.id, `Check missing id`);
        assert.ok(check.name, `Check ${check.id} missing name`);
        assert.ok(typeof check.weight === 'number', `Check ${check.id} missing weight`);
        assert.ok(typeof check.check === 'function', `Check ${check.id} missing check function`);
      }
    });

    test('weights sum to 100', () => {
      const totalWeight = CHECKS.reduce((sum, c) => sum + c.weight, 0);
      assert.strictEqual(totalWeight, 100, 'Weights should sum to 100');
    });
  });

  describe('runAudit', () => {
    test('audits perfect-repo with high grade', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      
      assert.ok(results.percentage >= 80, `Expected high score, got ${results.percentage}%`);
      assert.ok(['A', 'B'].includes(results.grade), `Expected A or B grade, got ${results.grade}`);
      assert.strictEqual(results.checks.length, CHECKS.length);
    });

    test('audits minimal-repo with lower grade', () => {
      const results = runAudit(join(FIXTURES, 'minimal-repo'));
      
      assert.ok(results.percentage < 50, `Expected low score, got ${results.percentage}%`);
      assert.ok(results.issues.length > 0, 'Expected issues');
      assert.ok(results.recommendations.length > 0, 'Expected recommendations');
    });

    test('audits empty-repo with failing grade', () => {
      const results = runAudit(join(FIXTURES, 'empty-repo'));
      
      assert.strictEqual(results.grade, 'F', 'Empty repo should fail');
      assert.ok(results.issues.length > 0, 'Expected many issues');
    });

    test('returns correct structure', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      
      assert.ok(results.directory, 'Should have directory');
      assert.ok(Array.isArray(results.checks), 'Should have checks array');
      assert.ok(typeof results.totalScore === 'number', 'Should have totalScore');
      assert.ok(typeof results.maxScore === 'number', 'Should have maxScore');
      assert.ok(typeof results.percentage === 'number', 'Should have percentage');
      assert.ok(typeof results.grade === 'string', 'Should have grade');
      assert.ok(Array.isArray(results.issues), 'Should have issues array');
      assert.ok(Array.isArray(results.recommendations), 'Should have recommendations array');
    });

    test('each check returns expected structure', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      
      for (const check of results.checks) {
        assert.ok(check.id, 'Check should have id');
        assert.ok(check.name, 'Check should have name');
        assert.ok(typeof check.score === 'number', 'Check should have score');
        assert.ok(typeof check.maxScore === 'number', 'Check should have maxScore');
        assert.ok(typeof check.weight === 'number', 'Check should have weight');
        assert.ok(typeof check.weightedScore === 'number', 'Check should have weightedScore');
        assert.ok(Array.isArray(check.issues), 'Check should have issues array');
        assert.ok(Array.isArray(check.recommendations), 'Check should have recommendations array');
      }
    });
  });

  describe('individual checks', () => {
    test('README check finds README.md', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const readme = results.checks.find(c => c.id === 'readme');
      
      assert.ok(readme.score > 50, 'Good README should score high');
      assert.strictEqual(readme.issues.length, 0, 'Good README should have no issues');
    });

    test('README check flags missing README', () => {
      const results = runAudit(join(FIXTURES, 'empty-repo'));
      const readme = results.checks.find(c => c.id === 'readme');
      
      assert.strictEqual(readme.score, 0, 'Missing README should score 0');
      assert.ok(readme.issues.length > 0, 'Should report issue');
    });

    test('LICENSE check finds license', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const license = results.checks.find(c => c.id === 'license');
      
      assert.strictEqual(license.score, 100, 'MIT license should score 100');
    });

    test('CI check finds GitHub Actions', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const ci = results.checks.find(c => c.id === 'ci');
      
      assert.strictEqual(ci.score, 100, 'GitHub Actions should score 100');
    });

    test('tests check finds test directory and config', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const tests = results.checks.find(c => c.id === 'tests');
      
      assert.ok(tests.score > 50, 'Should find tests directory and scripts');
    });

    test('linting check finds eslint config', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const linting = results.checks.find(c => c.id === 'linting');
      
      assert.ok(linting.score > 50, 'Should find eslint config');
    });

    test('typescript check finds tsconfig', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const ts = results.checks.find(c => c.id === 'typescript');
      
      assert.ok(ts.score > 80, 'Should find strict tsconfig');
    });

    test('package.json check validates fields', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const pkg = results.checks.find(c => c.id === 'packagejson');
      
      assert.ok(pkg.score > 70, 'Complete package.json should score high');
    });

    test('package.json check flags minimal package.json', () => {
      const results = runAudit(join(FIXTURES, 'minimal-repo'));
      const pkg = results.checks.find(c => c.id === 'packagejson');
      
      assert.ok(pkg.score < 50, 'Minimal package.json should score low');
      assert.ok(pkg.recommendations.length > 0, 'Should have recommendations');
    });

    test('contributing check finds CONTRIBUTING.md', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const contrib = results.checks.find(c => c.id === 'contributing');
      
      assert.ok(contrib.score > 70, 'Should find CONTRIBUTING.md');
    });

    test('security check finds SECURITY.md', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const security = results.checks.find(c => c.id === 'security');
      
      assert.ok(security.score > 70, 'Should find SECURITY.md');
    });

    test('editorconfig check finds .editorconfig', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const ec = results.checks.find(c => c.id === 'editorconfig');
      
      assert.ok(ec.score > 70, 'Should find .editorconfig');
    });
  });

  describe('percentage calculation', () => {
    test('percentage is normalized to 0-100', () => {
      const results1 = runAudit(join(FIXTURES, 'perfect-repo'));
      const results2 = runAudit(join(FIXTURES, 'empty-repo'));
      
      assert.ok(results1.percentage >= 0 && results1.percentage <= 100);
      assert.ok(results2.percentage >= 0 && results2.percentage <= 100);
    });

    test('weighted scores sum correctly', () => {
      const results = runAudit(join(FIXTURES, 'perfect-repo'));
      const sumWeightedScores = results.checks.reduce((sum, c) => sum + c.weightedScore, 0);
      
      // Allow small floating point differences
      assert.ok(Math.abs(sumWeightedScores - results.totalScore) < 0.5);
    });
  });
});
