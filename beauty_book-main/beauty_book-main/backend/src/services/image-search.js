import db from '../config/pg.js';
import {assert,HttpError} from '../lib/errors.js';
import {generateText,extractText,checkedImage} from './openai.js';
import {generateVisionText,isXaiConfigured} from './xai.js';
const VISION_PROMPT='Analyse uniquement les éléments beauté visibles sur cette image. Priorise la coiffure ou le style de cheveux (coupe, tresses, twists, locks, perruque, texture, couleur), puis le maquillage, les ongles et les soins si visibles. Ne déduis aucune caractéristique personnelle et ne donne aucun score. Réponds uniquement en JSON {"detected_items":[{"type":"nom court en français","color":"couleur"}]}, avec 5 éléments maximum.';
export function createImageSearch(database=db,generate=null){return async({image_url})=>{
 const safeImage=checkedImage(image_url);
 const useGrok=String(process.env.AI_IMAGE_PROVIDER||'').toLowerCase()==='grok' || (!process.env.OPENAI_API_KEY && isXaiConfigured());
 let responseText;
 if(generate){
  const response=await generate({input:[{role:'user',content:[{type:'input_image',image_url:safeImage},{type:'input_text',text:VISION_PROMPT}]}],max_output_tokens:450});
  responseText=extractText(response);
 }else if(useGrok){
  responseText=await generateVisionText({image_url:safeImage,prompt:VISION_PROMPT});
 }else{
  const response=await generateText({input:[{role:'user',content:[{type:'input_image',image_url:safeImage},{type:'input_text',text:VISION_PROMPT}]}],max_output_tokens:450});
  responseText=extractText(response);
 }
 let parsed;try{parsed=JSON.parse(String(responseText).replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw new HttpError(502,'INVALID_AI_RESULT','La recherche visuelle n’a pas pu identifier des articles.');}
 assert(Array.isArray(parsed.detected_items)&&parsed.detected_items.length<=5&&parsed.detected_items.every(i=>i&&typeof i.type==='string'&&i.type.length<=60&&typeof i.color==='string'&&i.color.length<=40),502,'INVALID_AI_RESULT','Résultat visuel inexploitable.');
 const patterns=parsed.detected_items.map(i=>i.type.replace(/[%_\\]/g,'').trim()).filter(Boolean).map(s=>'%'+s+'%');
 if(!patterns.length)return {detected_items:[],products:[]};
 const {rows}=await database.query('SELECT p.id,p.name,p.brand,p.price,p.images FROM public."Produit" p JOIN public.bb_seller_accounts s ON s.user_id=p.seller_user_id WHERE p.status=$1 AND s.status=$2 AND (p.name ILIKE ANY($3::text[]) OR p.category ILIKE ANY($3::text[])) ORDER BY p.created_at DESC LIMIT 20',['actif','active',patterns]);
 return {detected_items:parsed.detected_items,products:rows.map(p=>({...p,img:p.images?.[0]||'',url:'/produit/'+p.id}))};
};}
export const imageSearch=createImageSearch();
