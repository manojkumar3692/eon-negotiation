import {publicWidgetConfig} from '../../../../lib/conversion/public.js';
export async function GET(request,{params}){
 const {key}=await params,origin=request.headers.get('origin')||'';
 if(!/^[a-f0-9-]{36}$/i.test(key))return Response.json({enabled:false});
 try{const config=await publicWidgetConfig(key,origin);return Response.json(config,{headers:{'Access-Control-Allow-Origin':origin||'null','Vary':'Origin','Cache-Control':'no-store'}})}catch{return Response.json({enabled:false},{status:503});}
}
