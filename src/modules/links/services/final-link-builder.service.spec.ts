import { FinalLinkBuilderService } from './final-link-builder.service';

describe('FinalLinkBuilderService', () => {
  let service: FinalLinkBuilderService;

  beforeEach(() => {
    service = new FinalLinkBuilderService();
  });

  it('should build a final URL with campaign parameters', () => {
    const result = service.build('https://example.com', [
      { key: 'utm_source', value: 'FB' },
      { key: 'utm_medium', value: 'paid_social' },
    ]);

    expect(result).toBe('https://example.com/?utm_source=FB&utm_medium=paid_social');
  });

  it('should preserve existing query params and override duplicated keys', () => {
    const result = service.build('https://example.com?utm_source=old&page=1', [
      { key: 'utm_source', value: 'google' },
      { key: 'utm_campaign', value: 'launch' },
    ]);

    expect(result).toBe('https://example.com/?utm_source=google&page=1&utm_campaign=launch');
  });

  it('should append redirect using configured redirect param key', () => {
    const result = service.build(
      'https://example.com',
      [{ key: 'utm_source', value: 'FB' }],
      { targetUrl: 'https://checkout.example.com/oferta', paramKey: 'redirect' },
    );

    expect(result).toBe(
      'https://example.com/?utm_source=FB&redirect=https%3A%2F%2Fcheckout.example.com%2Foferta',
    );
  });
});
