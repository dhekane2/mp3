function formatResponse(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    try {
      const status = res.statusCode || 200;
      const statusMessages = {
        400: 'Bad request.',
        401: 'Unauthorized.',
        403: 'Forbidden.',
        404: 'Not found.',
        409: 'Conflict.',
        422: 'Unprocessable entity.',
        500: 'Internal server error.'
      };

      // If already in { message: string, data: any } shape, pass through
      if (
        body && typeof body === 'object' &&
        Object.prototype.hasOwnProperty.call(body, 'message') &&
        typeof body.message === 'string' &&
        Object.prototype.hasOwnProperty.call(body, 'data')
      ) {
        // For errors, default to null data EXCEPT allow 404 with [] for list endpoints
        if (status >= 400) {
          if (status === 404 && Array.isArray(body.data)) {
            // honor explicit empty arrays on not found
            return originalJson({ message: body.message, data: body.data });
          }
          return originalJson({ message: body.message, data: null });
        }
        return originalJson(body);
      }

      // For error statuses, never include raw body as data
      if (status >= 400) {
        // If body is a simple object with { message }, use it
        if (
          body && typeof body === 'object' &&
          Object.prototype.hasOwnProperty.call(body, 'message') &&
          typeof body.message === 'string'
        ) {
          return originalJson({ message: body.message, data: null });
        }
        // If body is a string, treat it as the message
        if (typeof body === 'string') {
          return originalJson({ message: body, data: null });
        }
        // Default generic message based on status code
        const fallback = statusMessages[status] || 'Error.';
        return originalJson({ message: fallback, data: null });
      }

      // Success path (<400)
      // If only message provided
      if (
        body && typeof body === 'object' &&
        Object.prototype.hasOwnProperty.call(body, 'message') &&
        typeof body.message === 'string' &&
        !Object.prototype.hasOwnProperty.call(body, 'data')
      ) {
        return originalJson({ message: body.message, data: null });
      }

      // Default success: wrap as { message: 'OK', data: body }
      return originalJson({ message: 'OK', data: body ?? null });
    } catch (e) {
      // Fallback: don't block response if formatter itself errors
      return originalJson({ message: 'Internal server error.', data: null });
    }
  };

  next();
}

module.exports = formatResponse;
