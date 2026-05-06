import { Injectable } from '@nestjs/common';

export type FinalLinkParameter = {
  key: string;
  value: string;
};

export type FinalLinkRedirect = {
  targetUrl: string;
  paramKey?: string | null;
};

@Injectable()
export class FinalLinkBuilderService {
  build(baseUrl: string, parameters: FinalLinkParameter[], redirect?: FinalLinkRedirect | null): string {
    const url = new URL(baseUrl);

    for (const parameter of parameters) {
      const key = parameter.key.trim();
      const value = parameter.value.trim();

      if (!key || !value) continue;

      url.searchParams.set(key, value);
    }

    if (redirect?.targetUrl) {
      url.searchParams.set(redirect.paramKey?.trim() || 'redirect', redirect.targetUrl.trim());
    }

    return url.toString();
  }
}
