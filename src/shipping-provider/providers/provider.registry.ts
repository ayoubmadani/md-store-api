import { ShippingProviderContract } from '../interfaces/shipping-provider.interface';
import { InvalidProviderException } from '../exceptions/shipping-exception.filter';

// Ecotrack-based providers
import {
  AndersonDeliveryProvider,
  AreexProvider,
  BaConsultProvider,
  ConexlogProvider,
  CoyoteExpressProvider,
  DhdProvider,
  DistazeroProvider,
  E48hrLivraisonProvider,
  FretdirectProvider,
  GolivriProvider,
  MonoHubProvider,
  MsmGoProvider,
  NegmarExpressProvider,
  PackersProvider,
  PrestProvider,
  RbLivraisonProvider,
  RexLivraisonProvider,
  RocketDeliveryProvider,
  SalvaDeliveryProvider,
  SpeedDeliveryProvider,
  TslExpressProvider,
  WorldexpressProvider,
} from './ecotrack/ecotrack.providers';

// Yalidine platform
import { YalidineProvider, YalitecProvider } from './yalidine/yalidine.providers';

// Procolis platform
import { ZRExpressProvider } from './procolis/zrexpress.provider';

// Independents
import { MaystroDeliveryProvider } from './maystro/maystro-delivery.provider';

// ─── Registry Type ────────────────────────────────────────────────────────────

type ProviderConstructor = new (
  credentials: Record<string, string>,
) => ShippingProviderContract;

// ─── Registry Map ─────────────────────────────────────────────────────────────

export const PROVIDER_REGISTRY: Record<string, ProviderConstructor> = {
  // Ecotrack platform
  AndersonDelivery: AndersonDeliveryProvider,
  Areex: AreexProvider,
  BaConsult: BaConsultProvider,
  Conexlog: ConexlogProvider,
  CoyoteExpress: CoyoteExpressProvider,
  Dhd: DhdProvider,
  Distazero: DistazeroProvider,
  E48hrLivraison: E48hrLivraisonProvider,
  Fretdirect: FretdirectProvider,
  Golivri: GolivriProvider,
  MonoHub: MonoHubProvider,
  MsmGo: MsmGoProvider,
  NegmarExpress: NegmarExpressProvider,
  Packers: PackersProvider,
  Prest: PrestProvider,
  RbLivraison: RbLivraisonProvider,
  RexLivraison: RexLivraisonProvider,
  RocketDelivery: RocketDeliveryProvider,
  SalvaDelivery: SalvaDeliveryProvider,
  SpeedDelivery: SpeedDeliveryProvider,
  TslExpress: TslExpressProvider,
  Worldexpress: WorldexpressProvider,

  // Yalidine platform
  Yalidine: YalidineProvider,
  Yalitec: YalitecProvider,

  // Procolis platform
  ZRExpress: ZRExpressProvider,

  // Independent
  MaystroDelivery: MaystroDeliveryProvider,
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createProvider(
  providerName: string,
  credentials: Record<string, string>,
): ShippingProviderContract {
  const ProviderClass = PROVIDER_REGISTRY[providerName];

  if (!ProviderClass) {
    throw new InvalidProviderException(providerName, Object.keys(PROVIDER_REGISTRY));
  }

  return new ProviderClass(credentials);
}

// ─── Static metadata list (for dashboard provider selector) ──────────────────
// Kept separate from provider instantiation — no credentials needed.

export const PROVIDERS_METADATA = [
  // ── Ecotrack platform ──────────────────────────────────────────────────────
  { key: 'AndersonDelivery', name: 'AndersonDelivery', title: 'Anderson Delivery',    logo: 'https://cdn1.ecotrack.dz/anderson/images/login_logoctVbSeP.png', description: 'Anderson Delivery — livraison express en Algérie',        website: 'https://anderson.ecotrack.dz/',         api_docs: 'https://anderson.ecotrack.dz/',         tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Areex',            name: 'Areex',            title: 'Areex',                logo: null,                                                              description: 'Areex — livraison express en Algérie',                   website: 'https://areex.ecotrack.dz/',            api_docs: 'https://areex.ecotrack.dz/',            tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'BaConsult',        name: 'BaConsult',        title: 'BA Consult',           logo: 'https://cdn1.ecotrack.dz/bacexpress/images/login_logoeORMVno.png', description: 'BA Consult — livraison express en Algérie',             website: 'https://bacexpress.ecotrack.dz/',       api_docs: 'https://bacexpress.ecotrack.dz/',       tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Conexlog',         name: 'Conexlog',         title: 'Conexlog (UPS)',       logo: 'https://conexlog-dz.com/assets/img/logo.png',                     description: 'CONEXLOG — prestataire exclusif UPS en Algérie',        website: 'https://conexlog-dz.com/',              api_docs: 'https://conexlog-dz.com/',              tracking_url: 'https://conexlog-dz.com/suivi.php' },
  { key: 'CoyoteExpress',    name: 'CoyoteExpress',    title: 'Coyote Express',       logo: null,                                                              description: 'Coyote Express — livraison express en Algérie',          website: 'https://coyoteexpressdz.ecotrack.dz/', api_docs: 'https://coyoteexpressdz.ecotrack.dz/', tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Dhd',              name: 'Dhd',              title: 'DHD',                  logo: 'https://dhd-dz.com/assets/img/logo.png',                          description: 'DHD — livraison express en Algérie',                    website: 'https://dhd-dz.com/',                   api_docs: 'https://dhd-dz.com/',                   tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Distazero',        name: 'Distazero',        title: 'Distazero',            logo: 'https://cdn1.ecotrack.dz/distazero/images/login_logooI8OebS.png', description: 'Distazero — livraison express en Algérie',              website: 'https://distazero.ecotrack.dz/',        api_docs: 'https://distazero.ecotrack.dz/',        tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'E48hrLivraison',   name: 'E48hrLivraison',   title: '48Hr Livraison',       logo: null,                                                              description: '48Hr Livraison — livraison express en Algérie',          website: 'https://48hr.ecotrack.dz/',             api_docs: 'https://48hr.ecotrack.dz/',             tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Fretdirect',       name: 'Fretdirect',       title: 'FRET.Direct',          logo: null,                                                              description: 'FRET.Direct — livraison express en Algérie',            website: 'https://fret.ecotrack.dz/',             api_docs: 'https://fret.ecotrack.dz/',             tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Golivri',          name: 'Golivri',          title: 'GOLIVRI',              logo: 'https://cdn1.ecotrack.dz/golivri/images/login_logoP2208XU.png',   description: 'GOLIVRI — livraison express en Algérie',                website: 'https://golivri.ecotrack.dz/',          api_docs: 'https://golivri.ecotrack.dz/',          tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'MonoHub',          name: 'MonoHub',          title: 'Mono Hub',             logo: null,                                                              description: 'Mono Hub — livraison express en Algérie',               website: 'https://mono.ecotrack.dz/',             api_docs: 'https://mono.ecotrack.dz/',             tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'MsmGo',            name: 'MsmGo',            title: 'MSM Go',               logo: null,                                                              description: 'MSM Go — livraison express en Algérie',                 website: 'https://msmgo.ecotrack.dz',             api_docs: 'https://msmgo.ecotrack.dz',             tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'NegmarExpress',    name: 'NegmarExpress',    title: 'Negmar Express',       logo: null,                                                              description: 'Negmar Express — livraison express en Algérie',          website: 'https://negmar.ecotrack.dz/',           api_docs: 'https://negmar.ecotrack.dz/',           tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Packers',          name: 'Packers',          title: 'Packers',              logo: null,                                                              description: 'Packers — livraison express en Algérie',                website: 'https://packers.ecotrack.dz/',          api_docs: 'https://packers.ecotrack.dz/',          tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Prest',            name: 'Prest',            title: 'Prest',                logo: null,                                                              description: 'Prest — livraison express en Algérie',                  website: 'https://prest.ecotrack.dz/',            api_docs: 'https://prest.ecotrack.dz/',            tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'RbLivraison',      name: 'RbLivraison',      title: 'RB Livraison',         logo: null,                                                              description: 'RB Livraison — livraison express en Algérie',           website: 'https://rblivraison.ecotrack.dz/',      api_docs: 'https://rblivraison.ecotrack.dz/',      tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'RexLivraison',     name: 'RexLivraison',     title: 'Rex Livraison',        logo: 'https://cdn1.ecotrack.dz/rex/images/login_logoCu3Rwdm.png',       description: 'Rex Livraison — livraison express en Algérie',          website: 'https://rex.ecotrack.dz/',              api_docs: 'https://rex.ecotrack.dz/',              tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'RocketDelivery',   name: 'RocketDelivery',   title: 'Rocket Delivery',      logo: 'https://cdn1.ecotrack.dz/rocket/images/login_logogAux6nt.png',    description: 'Rocket Delivery — livraison express en Algérie',        website: 'https://rocket.ecotrack.dz/',           api_docs: 'https://rocket.ecotrack.dz/',           tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'SalvaDelivery',    name: 'SalvaDelivery',    title: 'Salva Delivery',       logo: 'https://cdn1.ecotrack.dz/salvadelivery/images/login_logo6GOyzNz.png', description: 'Salva Delivery — livraison express en Algérie',      website: 'https://salvadelivery.ecotrack.dz/',    api_docs: 'https://salvadelivery.ecotrack.dz/',    tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'SpeedDelivery',    name: 'SpeedDelivery',    title: 'Speed Delivery',       logo: null,                                                              description: 'Speed Delivery — livraison express en Algérie',         website: 'https://speeddelivery.ecotrack.dz/',    api_docs: 'https://speeddelivery.ecotrack.dz/',    tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'TslExpress',       name: 'TslExpress',       title: 'TSL Express',          logo: 'https://cdn1.ecotrack.dz/tsl/images/login_logoxDIzsCJ.png',        description: 'TSL Express — livraison express en Algérie',           website: 'https://tsl.ecotrack.dz/',              api_docs: 'https://tsl.ecotrack.dz/',              tracking_url: 'https://suivi.ecotrack.dz/suivi/' },
  { key: 'Worldexpress',     name: 'Worldexpress',     title: 'WorldExpress',         logo: null,                                                              description: 'WorldExpress — livraison express en Algérie',           website: 'https://worldexpress.ecotrack.dz/',     api_docs: 'https://worldexpress.ecotrack.dz/',     tracking_url: 'https://suivi.ecotrack.dz/suivi/' },

  // ── Yalidine platform ──────────────────────────────────────────────────────
  { key: 'Yalidine',         name: 'Yalidine',         title: 'Yalidine',             logo: 'https://yalidine.com/assets/img/yalidine-logo.png',               description: 'Yalidine — société de livraison rapide et sécurisée',  website: 'https://yalidine.com/',                 api_docs: 'https://yalidine.app/app/dev/docs/api/index.php', tracking_url: 'https://yalidine.com/suivre-un-colis/' },
  { key: 'Yalitec',          name: 'Yalitec',          title: 'Yalitec',              logo: 'https://www.yalitec.com/_next/image?url=%2Fimages%2Flogo.png&w=384&q=75', description: 'Yalitec — société de livraison rapide et sécurisée', website: 'https://www.yalitec.com/fr',            api_docs: 'https://yalitec.me/app/dev/docs/api/index.php',  tracking_url: null },

  // ── Procolis platform ──────────────────────────────────────────────────────
  { key: 'ZRExpress',        name: 'ZRExpress',        title: 'ZR Express',           logo: 'https://zrexpress.com/ZREXPRESS_WEB/ext/Logo.jpg',                description: 'ZR Express — société de livraison rapide et sécurisée', website: 'https://zrexpress.com',                api_docs: 'https://zrexpress.com/ZREXPRESS_WEB/FR/Developpement.awp', tracking_url: null },

  // ── Independent ────────────────────────────────────────────────────────────
  { key: 'MaystroDelivery',  name: 'MaystroDelivery',  title: 'Maystro Delivery',     logo: 'https://maystro-delivery.com/img/Maystro-blue-extonly.svg',       description: 'Maystro Delivery — livraison rapide et sécurisée',     website: 'https://maystro-delivery.com/',         api_docs: 'https://maystro.gitbook.io/maystro-delivery-documentation', tracking_url: 'https://maystro-delivery.com/trackingSD.html' },
] as const;

export function getAllProvidersMetadata() {
  return PROVIDERS_METADATA;
}