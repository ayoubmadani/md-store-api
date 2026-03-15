import { EcotrackProviderIntegration } from '../../integrations/ecotrack.integration';
import { ProviderMetadata } from '../../interfaces/shipping-provider.interface';

function createEcotrackProvider(
  meta: Omit<ProviderMetadata, 'logo'> & { logo?: string | null },
  domain: string,
): new (credentials: Record<string, string>) => EcotrackProviderIntegration {
  return class extends EcotrackProviderIntegration {
    metadata(): ProviderMetadata {
      return { logo: null, ...meta };
    }
    apiDomain(): string {
      return domain;
    }
  };
}

export const AndersonDeliveryProvider = createEcotrackProvider(
  {
    name: 'AndersonDelivery',
    title: 'Anderson Delivery',
    logo: 'https://cdn1.ecotrack.dz/anderson/images/login_logoctVbSeP.png',
    description: 'Anderson Delivery — livraison express en Algérie',
    website: 'https://anderson.ecotrack.dz/',
    api_docs: 'https://anderson.ecotrack.dz/',
    support: 'https://anderson.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://anderson.ecotrack.dz/',
);

export const AreexProvider = createEcotrackProvider(
  {
    name: 'Areex',
    title: 'Areex',
    description: 'Areex — livraison express en Algérie',
    website: 'https://areex.ecotrack.dz/',
    api_docs: 'https://areex.ecotrack.dz/',
    support: 'https://areex.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://areex.ecotrack.dz/',
);

export const BaConsultProvider = createEcotrackProvider(
  {
    name: 'BaConsult',
    title: 'BA Consult',
    logo: 'https://cdn1.ecotrack.dz/bacexpress/images/login_logoeORMVno.png',
    description: 'BA Consult — livraison express en Algérie',
    website: 'https://bacexpress.ecotrack.dz/',
    api_docs: 'https://bacexpress.ecotrack.dz/',
    support: 'https://bacexpress.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://bacexpress.ecotrack.dz/',
);

export const ConexlogProvider = createEcotrackProvider(
  {
    name: 'Conexlog',
    title: 'Conexlog (UPS)',
    logo: 'https://conexlog-dz.com/assets/img/logo.png',
    description: 'CONEXLOG — prestataire exclusif UPS en Algérie',
    website: 'https://conexlog-dz.com/',
    api_docs: 'https://conexlog-dz.com/',
    support: 'https://conexlog-dz.com/contact.php',
    tracking_url: 'https://conexlog-dz.com/suivi.php',
  },
  'https://app.conexlog-dz.com/',
);

export const CoyoteExpressProvider = createEcotrackProvider(
  {
    name: 'CoyoteExpress',
    title: 'Coyote Express',
    description: 'Coyote Express — livraison express en Algérie',
    website: 'https://coyoteexpressdz.ecotrack.dz/',
    api_docs: 'https://coyoteexpressdz.ecotrack.dz/',
    support: 'https://coyoteexpressdz.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://coyoteexpressdz.ecotrack.dz/',
);

export const DhdProvider = createEcotrackProvider(
  {
    name: 'Dhd',
    title: 'DHD',
    logo: 'https://dhd-dz.com/assets/img/logo.png',
    description: 'DHD — livraison express en Algérie',
    website: 'https://dhd-dz.com/',
    api_docs: 'https://dhd-dz.com/',
    support: 'https://dhd-dz.com/#contact',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://dhd.ecotrack.dz/',
);

export const DistazeroProvider = createEcotrackProvider(
  {
    name: 'Distazero',
    title: 'Distazero',
    logo: 'https://cdn1.ecotrack.dz/distazero/images/login_logooI8OebS.png',
    description: 'Distazero — livraison express en Algérie',
    website: 'https://distazero.ecotrack.dz/',
    api_docs: 'https://distazero.ecotrack.dz/',
    support: 'https://distazero.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://distazero.ecotrack.dz/',
);

export const E48hrLivraisonProvider = createEcotrackProvider(
  {
    name: 'E48hrLivraison',
    title: '48Hr Livraison',
    description: '48Hr Livraison — livraison express en Algérie',
    website: 'https://48hr.ecotrack.dz/',
    api_docs: 'https://48hr.ecotrack.dz/',
    support: 'https://48hr.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://48hr.ecotrack.dz/',
);

export const FretdirectProvider = createEcotrackProvider(
  {
    name: 'Fretdirect',
    title: 'FRET.Direct',
    description: 'FRET.Direct — livraison express en Algérie',
    website: 'https://fret.ecotrack.dz/',
    api_docs: 'https://fret.ecotrack.dz/',
    support: 'https://fret.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://fret.ecotrack.dz/',
);

export const GolivriProvider = createEcotrackProvider(
  {
    name: 'Golivri',
    title: 'GOLIVRI',
    logo: 'https://cdn1.ecotrack.dz/golivri/images/login_logoP2208XU.png',
    description: 'GOLIVRI — livraison express en Algérie',
    website: 'https://golivri.ecotrack.dz/',
    api_docs: 'https://golivri.ecotrack.dz/',
    support: 'https://golivri.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://golivri.ecotrack.dz/',
);

export const MonoHubProvider = createEcotrackProvider(
  {
    name: 'MonoHub',
    title: 'Mono Hub',
    description: 'Mono Hub — livraison express en Algérie',
    website: 'https://mono.ecotrack.dz/',
    api_docs: 'https://mono.ecotrack.dz/',
    support: 'https://mono.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://mono.ecotrack.dz/',
);

export const MsmGoProvider = createEcotrackProvider(
  {
    name: 'MsmGo',
    title: 'MSM Go',
    description: 'MSM Go — livraison express en Algérie',
    website: 'https://msmgo.ecotrack.dz',
    api_docs: 'https://msmgo.ecotrack.dz',
    support: 'https://msmgo.ecotrack.dz',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://msmgo.ecotrack.dz',
);

export const NegmarExpressProvider = createEcotrackProvider(
  {
    name: 'NegmarExpress',
    title: 'Negmar Express',
    description: 'Negmar Express — livraison express en Algérie',
    website: 'https://negmar.ecotrack.dz/',
    api_docs: 'https://negmar.ecotrack.dz/',
    support: 'https://negmar.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://negmar.ecotrack.dz/',
);

export const PackersProvider = createEcotrackProvider(
  {
    name: 'Packers',
    title: 'Packers',
    description: 'Packers — livraison express en Algérie',
    website: 'https://packers.ecotrack.dz/',
    api_docs: 'https://packers.ecotrack.dz/',
    support: 'https://packers.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://packers.ecotrack.dz/',
);

export const PrestProvider = createEcotrackProvider(
  {
    name: 'Prest',
    title: 'Prest',
    description: 'Prest — livraison express en Algérie',
    website: 'https://prest.ecotrack.dz/',
    api_docs: 'https://prest.ecotrack.dz/',
    support: 'https://prest.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://prest.ecotrack.dz/',
);

export const RbLivraisonProvider = createEcotrackProvider(
  {
    name: 'RbLivraison',
    title: 'RB Livraison',
    description: 'RB Livraison — livraison express en Algérie',
    website: 'https://rblivraison.ecotrack.dz/',
    api_docs: 'https://rblivraison.ecotrack.dz/',
    support: 'https://rblivraison.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://rblivraison.ecotrack.dz/',
);

export const RexLivraisonProvider = createEcotrackProvider(
  {
    name: 'RexLivraison',
    title: 'Rex Livraison',
    logo: 'https://cdn1.ecotrack.dz/rex/images/login_logoCu3Rwdm.png',
    description: 'Rex Livraison — livraison express en Algérie',
    website: 'https://rex.ecotrack.dz/',
    api_docs: 'https://rex.ecotrack.dz/',
    support: 'https://rex.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://rex.ecotrack.dz/',
);

export const RocketDeliveryProvider = createEcotrackProvider(
  {
    name: 'RocketDelivery',
    title: 'Rocket Delivery',
    logo: 'https://cdn1.ecotrack.dz/rocket/images/login_logogAux6nt.png',
    description: 'Rocket Delivery — livraison express en Algérie',
    website: 'https://rocket.ecotrack.dz/',
    api_docs: 'https://rocket.ecotrack.dz/',
    support: 'https://rocket.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://rocket.ecotrack.dz/',
);

export const SalvaDeliveryProvider = createEcotrackProvider(
  {
    name: 'SalvaDelivery',
    title: 'Salva Delivery',
    logo: 'https://cdn1.ecotrack.dz/salvadelivery/images/login_logo6GOyzNz.png',
    description: 'Salva Delivery — livraison express en Algérie',
    website: 'https://salvadelivery.ecotrack.dz/',
    api_docs: 'https://salvadelivery.ecotrack.dz/',
    support: 'https://salvadelivery.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://salvadelivery.ecotrack.dz/',
);

export const SpeedDeliveryProvider = createEcotrackProvider(
  {
    name: 'SpeedDelivery',
    title: 'Speed Delivery',
    description: 'Speed Delivery — livraison express en Algérie',
    website: 'https://speeddelivery.ecotrack.dz/',
    api_docs: 'https://speeddelivery.ecotrack.dz/',
    support: 'https://speeddelivery.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://speeddelivery.ecotrack.dz/',
);

export const TslExpressProvider = createEcotrackProvider(
  {
    name: 'TslExpress',
    title: 'TSL Express',
    logo: 'https://cdn1.ecotrack.dz/tsl/images/login_logoxDIzsCJ.png',
    description: 'TSL Express — livraison express en Algérie',
    website: 'https://tsl.ecotrack.dz/',
    api_docs: 'https://tsl.ecotrack.dz/',
    support: 'https://tsl.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://tsl.ecotrack.dz/',
);

export const WorldexpressProvider = createEcotrackProvider(
  {
    name: 'Worldexpress',
    title: 'WorldExpress',
    description: 'WorldExpress — livraison express en Algérie',
    website: 'https://worldexpress.ecotrack.dz/',
    api_docs: 'https://worldexpress.ecotrack.dz/',
    support: 'https://worldexpress.ecotrack.dz/',
    tracking_url: 'https://suivi.ecotrack.dz/suivi/',
  },
  'https://worldexpress.ecotrack.dz/',
);