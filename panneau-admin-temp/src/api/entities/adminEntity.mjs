// Administrative writes must be confirmed by the server. Never turn a failed
// write into a successful local record or retry it through a different identity.
export function createAdminEntity(table, apiClient) {
  const request = async (operation, input = {}) => {
    const response = await apiClient.post('/admin/entities', { table, operation, ...input });
    return response.result;
  };
  return {
    filter: (filters = {}, orderBy = '-created_at', limit = 500) =>
      request('filter', { filters, orderBy, limit }),
    list: (orderBy = '-created_at', limit = 500) => request('list', { orderBy, limit }),
    get: id => request('get', { id }),
    create: data => request('create', { data }),
    update: (id, data) => request('update', { id, data }),
    delete: id => request('delete', { id }),
  };
}
