"use client";
import {useState} from 'react';
import OfferChat from './OfferChat.js';
export default function RecoveryLanding(){const [data,setData]=useState(null),[token,setToken]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function open(){setBusy(true);setError('');try{const secret=window.location.hash.slice(1);const r=await fetch('/api/negotiate/recovery-info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:secret})});const value=await r.json();if(!r.ok)throw Error(value.error||'Invitation unavailable');setToken(secret);setData(value);window.history.replaceState(null,'','/recover');}catch(e){setError(e.message)}finally{setBusy(false)}}
 if(data)return <OfferChat {...data} surface="recovery_link" recoveryToken={token}/>;
 return <main className="offer-shell"><section className="offer-card"><h1>Still interested?</h1><p>Your store invited you to explore an approved offer. This invitation expires and can start one negotiation.</p><button className="primary" disabled={busy} onClick={open}>View my invitation</button>{error&&<p role="alert">{error}</p>}</section></main>;
}
