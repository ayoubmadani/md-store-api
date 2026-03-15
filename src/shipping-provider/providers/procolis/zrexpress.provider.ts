import { ProcolisProviderIntegration } from '../../integrations/procolis.integration';
import { ProviderMetadata } from '../../interfaces/shipping-provider.interface';

export class ZRExpressProvider extends ProcolisProviderIntegration {
  metadata(): ProviderMetadata {
    return {
      name: 'ZRExpress',
      title: 'ZR Express',
      logo: 'https://play-lh.googleusercontent.com/_JY-6AlfdbrqaZMEosTsMUCnezFQACvr5iGP19U814Hlw0vIhta7GZSBdQcb9JLHBn2MpHdWzCewLeWb6oJ15Q',
      description: 'ZR Express — société de livraison rapide et sécurisée en Algérie',
      website: 'https://zrexpress.com',
      api_docs: 'https://zrexpress.com/ZREXPRESS_WEB/FR/Developpement.awp',
      support: 'https://www.facebook.com/ZRexpresslivraison/',
      tracking_url: null,
    };
  }
}