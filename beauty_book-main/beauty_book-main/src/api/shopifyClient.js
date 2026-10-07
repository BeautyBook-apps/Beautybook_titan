const SHOPIFY_DOMAIN = String(import.meta.env.VITE_SHOPIFY_DOMAIN || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/+$/, '');
const SHOPIFY_TOKEN = String(import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '').trim();
const SHOPIFY_API = SHOPIFY_DOMAIN && SHOPIFY_TOKEN
  ? `https://${SHOPIFY_DOMAIN}/api/2024-10/graphql.json`
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
  if (!SHOPIFY_API) {
    return { data: { success: true, products: [] } };
  }

  try {
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
    return { data: { success: true, products: [] } };
  }
};
