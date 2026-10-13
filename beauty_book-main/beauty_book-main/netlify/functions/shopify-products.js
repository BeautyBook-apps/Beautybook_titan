const API_VERSION = String(process.env.SHOPIFY_API_VERSION || process.env.VITE_SHOPIFY_API_VERSION || '2026-07').trim();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function getConfig() {
  const domain = String(process.env.SHOPIFY_DOMAIN || process.env.VITE_SHOPIFY_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const token = String(process.env.SHOPIFY_STOREFRONT_TOKEN || process.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '').trim();
  return { domain, token };
}

function mapProduct(node) {
  if (!node) return null;
  const variant = node.variants?.edges?.[0]?.node;
  const image = node.images?.edges?.[0]?.node;
  return {
    id: node.id,
    title: node.title,
    name: node.title,
    price: Number.parseFloat(variant?.price?.amount || '0'),
    img: image?.url || '',
    image_url: image?.url || '',
    images: (node.images?.edges || []).map(({ node: item }) => ({ url: item.url, altText: item.altText })),
    brand: node.vendor || '',
    vendor: node.vendor || '',
    category: node.productType || '',
    productType: node.productType || '',
    description: node.description || '',
    handle: node.handle,
    options: node.options || [],
    variants: (node.variants?.edges || []).map(({ node: item }) => ({
      id: item.id,
      title: item.title,
      price: Number.parseFloat(item.price?.amount || '0'),
      availableForSale: item.availableForSale,
      selectedOptions: item.selectedOptions,
      image: item.image,
      options: item.selectedOptions,
    })),
    _shopify: true,
  };
}

const PRODUCT_FIELDS = `
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

export default async function handler(event) {
  const { domain, token } = getConfig();
  if (!domain || !token) {
    return json(503, {
      success: false,
      code: 'SHOPIFY_NOT_CONFIGURED',
      error: 'Shopify n’est pas configuré sur Netlify. Ajoutez SHOPIFY_DOMAIN et SHOPIFY_STOREFRONT_TOKEN dans les variables du site.',
    });
  }

  const params = event.queryStringParameters || {};
  const productId = String(params.productId || '').trim();
  const first = Math.min(Math.max(Number.parseInt(params.first || '100', 10) || 100, 1), 250);
  const query = productId
    ? `query Product($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`
    : `query Products($first: Int!) { products(first: $first, sortKey: BEST_SELLING) { edges { node { ${PRODUCT_FIELDS} } } } }`;
  const variables = productId ? { id: productId } : { first };

  try {
    const response = await fetch(`https://${domain}/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.errors?.length) {
      const message = payload.errors?.[0]?.message || `Shopify a répondu avec le statut ${response.status}.`;
      return json(502, { success: false, code: 'SHOPIFY_REQUEST_FAILED', error: message });
    }

    if (productId) {
      return json(200, { success: true, product: mapProduct(payload.data?.product) });
    }
    const products = (payload.data?.products?.edges || []).map(({ node }) => mapProduct(node)).filter(Boolean);
    return json(200, { success: true, products });
  } catch (error) {
    return json(502, { success: false, code: 'SHOPIFY_REQUEST_FAILED', error: error?.message || 'Shopify est temporairement indisponible.' });
  }
}
