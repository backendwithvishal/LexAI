/**
 * Postman Collection Generator
 *
 * Generates a Postman v2.1 collection JSON from route definitions.
 * Output can be imported directly into Postman.
 */

/**
 * Build a Postman collection from a list of route definitions.
 *
 * @param {object} options
 * @param {string} options.name        - Collection name
 * @param {string} options.baseUrl     - Base URL variable (e.g. "{{base_url}}")
 * @param {Array}  options.routes      - Array of route objects
 * @returns {object} Postman collection JSON
 */
export function generatePostmanCollection({ name, baseUrl, routes }) {
    const items = routes.map((route) => ({
        name: route.name || `${route.method} ${route.path}`,
        request: {
            method: route.method.toUpperCase(),
            header: buildHeaders(route),
            url: {
                raw: `${baseUrl}${route.path}`,
                host: [baseUrl],
                path: route.path.split('/').filter(Boolean),
            },
            body: route.body ? {
                mode: 'raw',
                raw: JSON.stringify(route.body, null, 2),
                options: { raw: { language: 'json' } },
            } : undefined,
            description: route.description || '',
        },
    }));

    return {
        info: {
            name,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: items,
        variable: [
            { key: 'base_url', value: 'http://localhost:3100/api/v1' },
            { key: 'access_token', value: '' },
        ],
    };
}

function buildHeaders(route) {
    const headers = [];
    if (route.auth) {
        headers.push({ key: 'Authorization', value: 'Bearer {{access_token}}' });
    }
    if (['POST', 'PATCH', 'PUT'].includes(route.method?.toUpperCase()) && route.body) {
        headers.push({ key: 'Content-Type', value: 'application/json' });
    }
    return headers;
}
