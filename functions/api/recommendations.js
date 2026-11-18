import { handleRequest } from '../../api.mjs';

export function onRequest({ request }) {
  return handleRequest(request);
}
