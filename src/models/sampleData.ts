import type { AnyRule, Environment, HttpMethod, ResourceType } from './types.js';

export const DEFAULT_ENVIRONMENT_IDS = {
  none: 'default-none',
  qa: 'default-qa',
  prod: 'default-prod',
  build: 'default-build',
} as const;

export const POLICYBAZAAR_URL_REGEX =
  '^https?://(?:[a-z0-9-]+\\.)*policybazaar\\.com(?::[0-9]+)?(?:[/?].*)?$';

export function createDefaultEnvironments(): Environment[] {
  return [
    {
      id: DEFAULT_ENVIRONMENT_IDS.none,
      name: 'NONE',
      variables: [],
      isActive: true,
    },
    {
      id: DEFAULT_ENVIRONMENT_IDS.qa,
      name: 'QA',
      variables: [{
        key: 'API_KEY',
        value: 'REPLACE_WITH_QA_API_KEY',
        description: 'Replace with the authorized QA API key before enabling the apikey rule.',
        isSecret: true,
      }],
      isActive: false,
    },
    {
      id: DEFAULT_ENVIRONMENT_IDS.prod,
      name: 'PROD',
      variables: [{
        key: 'API_KEY',
        value: 'REPLACE_WITH_PROD_API_KEY',
        description: 'Replace with the authorized production API key before enabling the apikey rule.',
        isSecret: true,
      }],
      isActive: false,
    },
    {
      id: DEFAULT_ENVIRONMENT_IDS.build,
      name: 'BUILD',
      variables: [{
        key: 'HEALTH_BUILD',
        value: '1',
        description: 'Health build header value.',
      }],
      isActive: false,
    },
  ];
}

export function createDefaultRules(
  environmentIds: Record<keyof typeof DEFAULT_ENVIRONMENT_IDS, string> = DEFAULT_ENVIRONMENT_IDS
): AnyRule[] {
  const now = new Date().toISOString();
  const common = {
    enabled: true,
    createdAt: now,
    updatedAt: now,
    group: 'PolicyBazaar',
    priority: 1,
    urlMatcher: {
      pattern: POLICYBAZAAR_URL_REGEX,
      isRegex: true,
      resourceTypes: ['*'] as ResourceType[],
      httpMethods: ['*'] as HttpMethod[],
    },
  };

  return [
    {
      ...common,
      id: 'default-policybazaar-healthbuild',
      name: 'HealthBuild',
      description: 'Adds healthbuild only while the BUILD environment is active.',
      tags: ['policybazaar', 'build'],
      environmentIds: [environmentIds.build],
      type: 'header',
      target: 'request',
      headers: [{
        name: 'healthbuild',
        value: '{{HEALTH_BUILD}}',
        operation: 'set',
      }],
    },
    {
      ...common,
      id: 'default-policybazaar-apikey',
      name: 'apikey',
      description: 'Adds apikey only while the QA or PROD environment is active.',
      tags: ['policybazaar', 'authentication'],
      environmentIds: [environmentIds.qa, environmentIds.prod],
      type: 'header',
      target: 'request',
      headers: [{
        name: 'apikey',
        value: '{{API_KEY}}',
        operation: 'set',
      }],
    },
  ] as AnyRule[];
}
