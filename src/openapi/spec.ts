/**
 * OpenAPI specification generator
 * 
 * Dynamically generates OpenAPI 3.0 specification from registered routes
 * using @hono/zod-openapi
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Bindings } from '../types/bindings';
import * as schemas from '../schemas';

/**
 * Create OpenAPI registry and app for spec generation
 */
export const openApiRegistry = new OpenAPIHono<{ Bindings: Bindings }>();

// Import route definitions to register them
import { registerApiRoutes } from './routes';

/**
 * Register all API routes for OpenAPI documentation
 */
registerApiRoutes(openApiRegistry);

/**
 * GET /openapi.json
 * Returns OpenAPI specification in JSON format
 */
const openApiJsonRoute = createRoute({
  method: 'get',
  path: '/openapi.json',
  summary: 'Get OpenAPI specification (JSON)',
  description: 'Returns the OpenAPI 3.0 specification in JSON format',
  responses: {
    200: {
      description: 'OpenAPI specification',
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
  tags: ['Documentation'],
});

openApiRegistry.openapi(openApiJsonRoute, (c) => {
  const spec = openApiRegistry.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'Social Justice Investor API',
      version: '1.0.0',
      description: 'API for The Social Justice Investor podcast research and planning platform',
    },
    servers: [
      {
        url: 'https://social-investing.hacolby.workers.dev',
        description: 'Production server',
      },
    ],
  });
  return c.json(spec);
});

/**
 * GET /openapi.yaml
 * Returns OpenAPI specification in YAML format
 */
const openApiYamlRoute = createRoute({
  method: 'get',
  path: '/openapi.yaml',
  summary: 'Get OpenAPI specification (YAML)',
  description: 'Returns the OpenAPI 3.0 specification in YAML format',
  responses: {
    200: {
      description: 'OpenAPI specification',
      content: {
        'application/x-yaml': {
          schema: z.string(),
        },
      },
    },
  },
  tags: ['Documentation'],
});

openApiRegistry.openapi(openApiYamlRoute, async (c) => {
  const spec = openApiRegistry.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'Social Justice Investor API',
      version: '1.0.0',
      description: 'API for The Social Justice Investor podcast research and planning platform',
    },
    servers: [
      {
        url: 'https://social-investing.hacolby.workers.dev',
        description: 'Production server',
      },
    ],
  });
  // Convert JSON to YAML (simple implementation)
  const yaml = jsonToYaml(spec);
  return c.text(yaml, 200, {
    'Content-Type': 'application/x-yaml',
  });
});

/**
 * Simple JSON to YAML converter
 * For production, consider using a proper YAML library
 */
function jsonToYaml(obj: any, indent = 0): string {
  const indentStr = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        yaml += indentStr + '-\n';
        yaml += jsonToYaml(item, indent + 1);
      } else {
        yaml += indentStr + '- ' + stringifyValue(item) + '\n';
      }
    }
  } else if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        yaml += indentStr + key + ':\n';
        yaml += jsonToYaml(value, indent + 1);
      } else if (typeof value === 'object') {
        yaml += indentStr + key + ':\n';
        yaml += jsonToYaml(value, indent + 1);
      } else {
        yaml += indentStr + key + ': ' + stringifyValue(value) + '\n';
      }
    }
  }

  return yaml;
}

function stringifyValue(value: any): string {
  if (typeof value === 'string') {
    // Escape special characters and quote if needed
    if (value.includes(':') || value.includes('\n') || value.includes("'") || value.includes('"')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

