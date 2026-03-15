import { YalidineProviderIntegration } from '../../integrations/yalidine.integration';
import { ProviderMetadata } from '../../interfaces/shipping-provider.interface';

export class YalidineProvider extends YalidineProviderIntegration {
  apiDomain(): string {
    return 'https://api.yalidine.app';
  }

  metadata(): ProviderMetadata {
    return {
      name: 'Yalidine',
      title: 'Yalidine',
      logo: 'https://yalidine.com/assets/img/yalidine-logo.png',
      description: 'Yalidine — société de livraison rapide et sécurisée en Algérie',
      website: 'https://yalidine.com/',
      api_docs: 'https://yalidine.app/app/dev/docs/api/index.php',
      support: 'https://yalidine.com/#contact',
      tracking_url: 'https://yalidine.com/suivre-un-colis/',
    };
  }
}

export class YalitecProvider extends YalidineProviderIntegration {
  apiDomain(): string {
    return 'https://api.yalitec.me';
  }

  metadata(): ProviderMetadata {
    return {
      name: 'Yalitec',
      title: 'Yalitec',
      logo: 'https://www.yalitec.com/_next/image?url=%2Fimages%2Flogo.png&w=384&q=75',
      description: 'Yalitec — société de livraison rapide et sécurisée en Algérie',
      website: 'https://www.yalitec.com/fr',
      api_docs: 'https://yalitec.me/app/dev/docs/api/index.php',
      support: 'https://www.yalitec.com/fr#contact',
      tracking_url: null,
    };
  }
}