import './src/config/env.js';
import {missingConfiguration} from './src/config/env.js';
import {getPool} from './src/config/pg.js';
import {inspectSchema} from './src/services/readiness.js';
const report={missingConfiguration:missingConfiguration(),database:{reachable:false},integrations:Object.fromEntries(['OPENAI_API_KEY','XAI_API_KEY','GROK_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','TWILIO_AUTH_TOKEN','META_APP_SECRET'].map(key=>[key,!!process.env[key]]))};
try{
 if(process.env.DATABASE_URL){report.database=await inspectSchema();report.database.reachable=true;}
 else report.database.code='DATABASE_NOT_CONFIGURED';
}catch(error){report.database={reachable:false,code:error.code||'DATABASE_CONNECTION_FAILED'};}
finally{if(process.env.DATABASE_URL){try{await getPool().end();}catch{}}}
console.log(JSON.stringify(report,null,2));
if(report.missingConfiguration.length||!report.database.ready)process.exitCode=1;
