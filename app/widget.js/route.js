export async function GET(request){
 const origin=new URL(request.url).origin;
 const script=`(()=>{const s=document.currentScript;if(!s)return;const k=s.dataset.workspace,p=s.dataset.product,v=s.dataset.variant,c=s.dataset.currency,surface=s.dataset.surface||'product';if(!k||!p||!v||!c)return;
 const started=Date.now();let visits=1,visitor=crypto.randomUUID(),dismissed=false;try{const key='eon-visits:'+k+':'+v;visits=Number(localStorage.getItem(key)||0)+1;localStorage.setItem(key,String(visits));visitor=localStorage.getItem('eon-visitor:'+k)||visitor;localStorage.setItem('eon-visitor:'+k,visitor)}catch{}
 fetch('${origin}/api/widget-config/'+encodeURIComponent(k),{credentials:'omit'}).then(r=>r.json()).then(config=>{
 if(!config.enabled||!config.surfaces[surface])return;
 const button=document.createElement('button');button.type='button';button.textContent=s.dataset.label||'Make an offer';button.hidden=true;
 Object.assign(button.style,{position:'fixed',right:'20px',bottom:'20px',zIndex:'2147483646',border:'0',borderRadius:'999px',padding:'14px 20px',background:'#173e33',color:'#fff',font:'600 14px system-ui',cursor:'pointer'});
 const modal=document.createElement('div');Object.assign(modal.style,{display:'none',position:'fixed',inset:'0',zIndex:'2147483647',background:'#0008',padding:'20px'});
 const frame=document.createElement('iframe');frame.title='Negotiate an offer';Object.assign(frame.style,{width:'min(480px,100%)',height:'min(760px,100%)',display:'block',margin:'auto',border:'0',borderRadius:'20px',background:'#fff'});
 const close=document.createElement('button');close.textContent='Close';close.type='button';close.setAttribute('aria-label','Close negotiation');Object.assign(close.style,{position:'absolute',right:'20px',top:'8px',padding:'8px'});
 function dismiss(){modal.style.display='none';dismissed=true;try{localStorage.setItem('eon-dismiss:'+k,String(Date.now()))}catch{}button.focus()}
 close.onclick=dismiss;modal.append(close,frame);modal.onclick=e=>{if(e.target===modal)dismiss()};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.style.display!=='none')dismiss()});
 function reveal(){let last=0;try{last=Number(localStorage.getItem('eon-dismiss:'+k)||0)}catch{}if(dismissed||Date.now()-last<config.triggers.cooldownHours*3600000)return;button.hidden=false}
 button.onclick=()=>{frame.src='${origin}/offer/'+encodeURIComponent(k)+'?'+new URLSearchParams({productId:p,variantId:v,currency:c,surface,visits:String(visits),dwellSeconds:String(Math.floor((Date.now()-started)/1000)),visitorId:visitor});modal.style.display='block';close.focus()};
 document.body.append(button,modal);
 if(surface==='exit_intent')document.addEventListener('mouseleave',e=>{if(e.clientY<=0&&visits>=config.triggers.minVisits)reveal()});
 else {if(visits>=config.triggers.minVisits)reveal();setTimeout(reveal,config.triggers.minDwellSeconds*1000)}
 }).catch(()=>{});})();`;
 return new Response(script,{headers:{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
}
