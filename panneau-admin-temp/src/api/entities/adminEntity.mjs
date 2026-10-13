// Administrative writes must be confirmed by the server. Never turn a failed
// write into a successful local record or retry it through a different identity.
export function createAdminEntity(table, apiClient) {
  const request = async (operation, input = {}) => {
    const response = await apiClient.post('/admin/entities', { table, operation, ...input });
    return response.result;
  };

  // The local admin server validates the payload against the currently
  // deployed Supabase schema. During a rolling migration, a field can still
  // be accepted by the UI while the database column is not available yet.
  // Remove only the exact missing field reported by the server, then retry;
  // all other errors still reach the caller unchanged.
  const createWithSchemaCompatibility = async (data) => {
    const payload = { ...data };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await request('create', { data: payload });
      } catch (error) {
        const missingField = error?.status === 409
          ? error.message?.match(/Le champ ([A-Za-z_][A-Za-z0-9_]*) n[’']existe pas encore/i)?.[1]
          : null;
        if (table === 'ImmobilierListing' && ['estimated_turnover', 'estimated_net_revenue', 'virtual_tour_id'].includes(missingField)) throw error;
        if (!missingField || !Object.prototype.hasOwnProperty.call(payload, missingField)) throw error;
        delete payload[missingField];
      }
    }
    throw new Error('Le schéma immobilier est incomplet. Appliquez la migration avant de créer cette annonce.');
  };

  const updateWithSchemaCompatibility = async (id, data) => {
    const payload = { ...data };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        return await request('update', { id, data: payload });
      } catch (error) {
        const missingField = error?.status === 409
          ? error.message?.match(/Le champ ([A-Za-z_][A-Za-z0-9_]*) n[’']existe pas encore/i)?.[1]
          : null;
        if (table === 'ImmobilierListing' && ['estimated_turnover', 'estimated_net_revenue', 'virtual_tour_id'].includes(missingField)) throw error;
        if (!missingField || !Object.prototype.hasOwnProperty.call(payload, missingField)) throw error;
        delete payload[missingField];
      }
    }
    throw new Error('Le schéma est incomplet. Appliquez la migration avant de modifier cette annonce.');
  };

  return {
    filter: (filters = {}, orderBy = '-created_at', limit = 500) =>
      request('filter', { filters, orderBy, limit }),
    list: (orderBy = '-created_at', limit = 500) => request('list', { orderBy, limit }),
    get: id => request('get', { id }),
    create: createWithSchemaCompatibility,
    update: updateWithSchemaCompatibility,
    delete: id => request('delete', { id }),
  };
}
