import { getIntegrationStatus } from './integrationsApi';

const response = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => payload,
});

describe('getIntegrationStatus', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses the authenticated Admin request and only enables a deliberate refresh', async () => {
    const request = jest.fn().mockResolvedValue({ database: { configured: true } });

    await expect(getIntegrationStatus(request)).resolves.toEqual({ database: { configured: true } });
    await expect(getIntegrationStatus(request, { refresh: true })).resolves.toEqual({ database: { configured: true } });

    expect(request).toHaveBeenNthCalledWith(1, '/api/admin/integrations');
    expect(request).toHaveBeenNthCalledWith(2, '/api/admin/integrations?refresh=1');
  });
});
