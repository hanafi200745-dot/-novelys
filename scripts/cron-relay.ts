/** Optional standalone scheduled Worker. Configure APP_URL and CRON_SECRET as secrets. */
export default {
 async scheduled(_event:unknown,env:{APP_URL:string;CRON_SECRET:string},ctx:{waitUntil(p:Promise<unknown>):void}){
  ctx.waitUntil((async()=>{if(!env.APP_URL?.startsWith('https://')||!env.CRON_SECRET)throw new Error('Configuration du planificateur manquante');const response=await fetch(env.APP_URL.replace(/\/$/,'')+'/api/jobs',{method:'POST',headers:{Authorization:'Bearer '+env.CRON_SECRET}});if(!response.ok)throw new Error('Échec du traitement des notifications : '+response.status);})());
 }
};
