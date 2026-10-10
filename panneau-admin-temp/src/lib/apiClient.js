import { supabase } from '@/api/supabaseClient';
export const localAdminEnabled = import.meta.env.DEV && typeof __LOCAL_ADMIN_TOKEN__ !== 'undefined' && Boolean(__LOCAL_ADMIN_TOKEN__);
export const apiClient = {
  async request(endpoint, options={}) {
    const path=endpoint.startsWith('/api/') ? endpoint : '/api'+endpoint;
    const localPath = localAdminEnabled && ({ '/api/admin/entities': '/__local-admin/entities', '/api/admin/stats': '/__local-admin/stats', '/api/admin/upload': '/__local-admin/upload', '/api/content/styles/engagement-stats': '/__local-admin/style-engagement' })[path];
    const session = localPath ? null : (await supabase.auth.getSession()).data.session;
    if (!localPath && (!session || session.user?.is_anonymous)) {
      const error = new Error('Connectez-vous avec votre compte administrateur pour continuer.');
      error.code = 'AUTH_REQUIRED'; error.status = 401;
      throw error;
    }
    const base=(import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/,'').replace(/\/api$/,'');
    let response;
    try { response=await fetch(localPath || base+path,{...options,headers:{'Content-Type':'application/json',...(localPath ? {'X-BeautyBook-Local-Admin':__LOCAL_ADMIN_TOKEN__} : session?.access_token?{Authorization:'Bearer '+session.access_token}:{}),...options.headers},signal:AbortSignal.timeout(30000)}); }
    catch { throw new Error('Le serveur BeautyBook est injoignable. Vérifiez votre connexion et réessayez.'); }
    const body=await response.json().catch(()=>({error:response.status >= 500 ? 'Le backend BeautyBook est indisponible. Démarrez et configurez le serveur API.' : 'Réponse serveur invalide.'}));
    if(!response.ok || body.success===false || body.error) { const error=new Error(body.error || 'Opération refusée.'); error.code=body.code; error.status=response.status; window.dispatchEvent(new CustomEvent('bb:api-error',{detail:error.message})); throw error; }
    return body;
  },
  get(path){return this.request(path);},
  post(path,data){return this.request(path,{method:'POST',body:JSON.stringify(data)});},
  put(path,data){return this.request(path,{method:'PUT',body:JSON.stringify(data)});},
  delete(path){return this.request(path,{method:'DELETE'});},
  async callFunction(name,payload={}){
    if(name==='adminCreateService'){
      const {action,id,...input}=payload;
      const operation=action==='delete'?'delete':id?'update':'create';
      const result=await this.post('/admin/entities',{table:'Service',operation,id,data:input.data||input});
      return {data:{success:true,service:result.result}};
    }
    throw new Error('Cette action doit utiliser son API administrative dédiée.');
  },
};
export default apiClient;
