import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDnrRules } from '../dist/background/ruleEngine.js';
import {
  createDefaultEnvironments,
  createDefaultRules,
  POLICYBAZAAR_URL_REGEX,
} from '../dist/models/sampleData.js';
import { validateExportSchema, validateRule } from '../dist/validation/schema.js';
import {
  matchesUrlPattern,
  redactSensitiveUrl,
  ruleMatchesRequest,
} from '../dist/utils/ruleMatcher.js';

const base = {
  name: 'Rule',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  priority: 1,
  urlMatcher: {
    pattern: 'https://api.example.com/*',
    isRegex: false,
    resourceTypes: ['xmlhttprequest'],
    httpMethods: ['GET'],
  },
};

test('DNR IDs remain unique for a large rule set', () => {
  const rules = Array.from({ length: 3000 }, (_, index) => ({
    ...base,
    id: `rule-${index}`,
    type: 'redirect',
    redirectUrl: `https://target.example.com/${index}`,
  }));
  const compiled = buildDnrRules(rules, null);
  assert.equal(compiled.length, rules.length);
  assert.equal(new Set(compiled.map((rule) => rule.id)).size, rules.length);
});

test('document resource type maps to Chromium frame types', () => {
  const compiled = buildDnrRules([{
    ...base,
    id: 'document-rule',
    type: 'redirect',
    redirectUrl: 'https://target.example.com/',
    urlMatcher: { ...base.urlMatcher, resourceTypes: ['document'] },
  }], null);
  assert.deepEqual(compiled[0].condition.resourceTypes, ['main_frame', 'sub_frame']);
});

test('request header append validation follows Chromium allowlist', () => {
  const invalid = validateRule({
    ...base,
    id: 'bad-header',
    type: 'header',
    target: 'request',
    headers: [{ name: 'X-Custom', value: 'a', operation: 'append' }],
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /cannot append/i);

  const valid = validateRule({
    ...base,
    id: 'good-header',
    type: 'header',
    target: 'request',
    headers: [{ name: 'Cookie', value: 'a=b', operation: 'append' }],
  });
  assert.equal(valid.valid, true);
});

test('matching honors URL, method, and resource filters', () => {
  const rule = {
    ...base,
    id: 'match-rule',
    type: 'redirect',
    redirectUrl: 'https://target.example.com/',
  };
  assert.equal(ruleMatchesRequest(
    rule,
    { url: 'https://api.example.com/users', method: 'GET', resourceType: 'xmlhttprequest' },
    null
  ), true);
  assert.equal(ruleMatchesRequest(
    rule,
    { url: 'https://api.example.com/users', method: 'POST', resourceType: 'xmlhttprequest' },
    null
  ), false);
  assert.equal(matchesUrlPattern('https://*.example.com/*', false, 'https://api.example.com/a'), true);
});

test('history redaction removes common sensitive query values', () => {
  const redacted = redactSensitiveUrl(
    'https://example.com/path?token=abc&name=Akash&api_key=secret'
  );
  assert.match(redacted, /name=Akash/);
  assert.doesNotMatch(redacted, /abc|secret/);
});

test('import validation rejects duplicate IDs and malformed environments', () => {
  const rule = {
    ...base,
    id: 'duplicate',
    type: 'redirect',
    redirectUrl: 'https://target.example.com/',
  };
  const result = validateExportSchema({
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    rules: [rule, rule],
    environments: [{
      id: 'env',
      name: 'Development',
      isActive: true,
      variables: [
        { key: 'TOKEN', value: 'one' },
        { key: 'TOKEN', value: 'two' },
      ],
    }],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /duplicate/i);
});

test('first-install defaults contain the requested environments and variables', () => {
  const environments = createDefaultEnvironments();
  assert.deepEqual(environments.map((environment) => environment.name), [
    'NONE', 'QA', 'PROD', 'BUILD',
  ]);
  assert.equal(environments.find((environment) => environment.name === 'NONE').isActive, true);
  assert.equal(environments.find((environment) => environment.name === 'NONE').variables.length, 0);
  assert.equal(environments.find((environment) => environment.name === 'QA').variables[0].key, 'API_KEY');
  assert.equal(environments.find((environment) => environment.name === 'PROD').variables[0].key, 'API_KEY');
  assert.deepEqual(environments.find((environment) => environment.name === 'BUILD').variables[0], {
    key: 'HEALTH_BUILD',
    value: '1',
    description: 'Health build header value.',
  });
});

test('PolicyBazaar defaults apply only in their selected environments', () => {
  const rules = createDefaultRules();
  const environments = createDefaultEnvironments();
  const none = environments.find((environment) => environment.name === 'NONE');
  const qa = environments.find((environment) => environment.name === 'QA');
  const prod = environments.find((environment) => environment.name === 'PROD');
  const build = environments.find((environment) => environment.name === 'BUILD');

  assert.equal(matchesUrlPattern(
    POLICYBAZAAR_URL_REGEX,
    true,
    'https://health.policybazaar.com/api/check?source=test'
  ), true);
  assert.equal(buildDnrRules(rules, none).length, 0);
  assert.equal(buildDnrRules(rules, qa).length, 1);
  assert.equal(buildDnrRules(rules, prod).length, 1);
  assert.equal(buildDnrRules(rules, build).length, 1);
  assert.equal(
    buildDnrRules(rules, build)[0].action.requestHeaders[0].value,
    '1'
  );
});
