export function getIntegrationStatus(request, { refresh = false } = {}) {
  return request(refresh ? '/api/admin/integrations?refresh=1' : '/api/admin/integrations');
}
