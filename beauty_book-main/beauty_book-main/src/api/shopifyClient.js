const SHOPIFY_DOMAIN = String(import.meta.env.VITE_SHOPIFY_DOMAIN || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');
const SHOPIFY_TOKEN = String(import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '').trim();
const SHOPIFY_API_VERSION = String(import.meta.env.VITE_SHOPIFY_API_VERSION || '2026-07').trim();
const SHOPIFY_API = SHOPIFY_DOMAIN && SHOPIFY_TOKEN
  ? `https://${SHOPIFY_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`
  : null;

const shopifyHeaders = {
  'Content-Type': 'application/json',
  ...(SHOPIFY_TOKEN ? { 'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN } : {}),
};

async function shopifyQuery(query, variables = {}) {
  if (!SHOPIFY_API) return null;

  try {
    const res = await fetch(SHOPIFY_API, {
      method: 'POST',
      headers: shopifyHeaders,
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) throw new Error(`Shopify API status ${res.status}`);
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0]?.message || 'Shopify GraphQL error');
    return json.data;
  } catch (err) {
    console.warn('[Shopify] Query fallback:', err.message);
    return null;
  }
}

const SINGLE_PRODUCT_FIELDS = `
  id title description handle
  vendor productType
  options { name values }
  images(first: 10) { edges { node { url altText } } }
  variants(first: 25) {
    edges { node {
      id title availableForSale
      price { amount currencyCode }
      selectedOptions { name value }
      image { url }
    } }
  }
`;

function mapShopifyProduct(node) {
  if (!node) return null;
  const variant = node.variants?.edges?.[0]?.node;
  const image = node.images?.edges?.[0]?.node;
  return {
    id: node.id,
    title: node.title,
    name: node.title,
    price: parseFloat(variant?.price?.amount || '0'),
    img: image?.url || '',
    image_url: image?.url || '',
    images: (node.images?.edges || []).map(e => ({ url: e.node.url, altText: e.node.altText })),
    brand: node.vendor || '',
    vendor: node.vendor || '',
    category: node.productType || '',
    productType: node.productType || '',
    description: node.description || '',
    handle: node.handle,
    options: node.options || [],
    variants: (node.variants?.edges || []).map(e => ({
      id: e.node.id,
      title: e.node.title,
      price: parseFloat(e.node.price?.amount || '0'),
      availableForSale: e.node.availableForSale,
      selectedOptions: e.node.selectedOptions,
      image: e.node.image,
      options: e.node.selectedOptions,
    })),
    _shopify: true,
  };
}

export const fetchShopifyProducts = async (options = {}) => {
  try {
    // En production Netlify, keep the Storefront request behind a same-origin
    // function. This avoids depending on a Vite-only .env.local file at build
    // time and gives us a useful configuration error instead of an empty list.
    if (import.meta.env.PROD && typeof window !== 'undefined') {
      const params = new URLSearchParams();
      if (options.productId) params.set('productId', options.productId);
      if (options.first) params.set('first', String(options.first));
      const response = await fetch(`/api/shopify-products${params.toString() ? `?${params}` : ''}`);
      if (response.ok) {
        const payload = await response.json();
        if (payload?.success === false) throw new Error(payload.error || 'Impossible de charger les produits Shopify.');
        return { data: payload };
      }
      // The direct Storefront fallback keeps local/custom deployments working
      // while the Netlify function is being configured.
      if (response.status !== 404 && !SHOPIFY_API) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Shopify indisponible (${response.status}).`);
      }
    }

    if (!SHOPIFY_API) {
      throw new Error('La boutique Shopify n’est pas configurée sur ce déploiement.');
    }

    if (options.productId) {
      const data = await shopifyQuery(`
        query ($id: ID!) {
          product(id: $id) {
            ${SINGLE_PRODUCT_FIELDS}
          }
        }
      `, { id: options.productId });
      return { data: { success: true, product: data?.product ? mapShopifyProduct(data.product) : null } };
    }

    const first = options.first || 50;
    const data = await shopifyQuery(`
      query ($first: Int!) {
        products(first: $first, sortKey: BEST_SELLING) {
          edges { node {
            id title description handle
            vendor productType
            images(first: 1) { edges { node { url altText } } }
            variants(first: 3) {
              edges { node {
                id title
                price { amount currencyCode }
                selectedOptions { name value }
              } }
            }
          } }
        }
      }
    `, { first });

    const products = (data?.products?.edges || []).map(e => mapShopifyProduct(e.node)).filter(Boolean);
    return { data: { success: true, products } };
  } catch (err) {
    console.warn('[Shopify] Fetch error:', err.message);
    return { data: { success: false, products: [], error: err.message } };
  }
};

/**
 * Creates a Shopify cart for a product purchased from the connected store.
 * The public Storefront token is intentionally used here: only the checkout
 * URL is returned to the browser and Shopify remains the source of truth for
 * inventory, shipping and payment.
 */
export const createShopifyCheckout = async ({ variantId, quantity = 1, email, countryCode, address = {} }) => {
  if (!SHOPIFY_API) throw new Error('La boutique Shopify n’est pas configurée.');
  if (!/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(String(variantId || ''))) {
    throw new Error('Variante Shopify invalide.');
  }

  const query = `
    mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }
  `;
  const input = {
    lines: [{ merchandiseId: variantId, quantity: Math.max(1, Number(quantity) || 1) }],
    ...(email || address.phone ? {
      buyerIdentity: {
        ...(email ? { email } : {}),
        ...(address.phone ? { phone: address.phone } : {}),
        ...(countryCode ? { countryCode } : {}),
      },
    } : {}),
    attributes: Object.entries({
      'Prénom': address.firstName,
      'Nom': address.lastName,
      Adresse: address.address1,
      'Complément': address.address2,
      Ville: address.city,
      'Code postal': address.zip,
      Pays: countryCode,
    }).filter(([, value]) => String(value || '').trim()).map(([key, value]) => ({ key, value: String(value).trim() })),
  };

  const response = await fetch(SHOPIFY_API, {
    method: 'POST',
    headers: shopifyHeaders,
    body: JSON.stringify({ query, variables: { input } }),
  });
  if (!response.ok) throw new Error(`Shopify ne répond pas (${response.status}).`);

  const json = await response.json();
  const cart = json.data?.cartCreate;
  const message = json.errors?.[0]?.message || cart?.userErrors?.[0]?.message;
  if (message || !cart?.cart?.checkoutUrl) {
    throw new Error(message || 'Ce produit Shopify ne peut pas être commandé actuellement.');
  }

  const checkoutUrl = new URL(cart.cart.checkoutUrl);
  if (checkoutUrl.protocol !== 'https:' || !checkoutUrl.hostname.endsWith('.myshopify.com')) {
    throw new Error('Shopify a renvoyé une adresse de paiement invalide.');
  }
  return { checkoutUrl: checkoutUrl.href };
};
