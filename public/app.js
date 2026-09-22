let id;
const form = document.querySelector('form');
const log = document.querySelector('#messages');
const confirm = document.querySelector('#confirm');
const reset = document.querySelector('#reset');
function append(text) { const p = document.createElement('p'); p.textContent = text; log.append(p); }
async function call(body) {
 const res = await fetch('/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await res.json(); if (!res.ok) throw new Error(data.message || data.error); return data;
}
async function send(body) {
 const button = form.querySelector('button'); button.disabled = true; confirm.disabled = true; reset.disabled = true;
 try {
  if (!id) id = (await call({ action: 'start' })).id;
  const result = await call({ id, ...body });
  append(result.message); confirm.hidden = !result.confirmPrice; form.hidden = Boolean(result.done);
 } catch(error) { append(error.message); }
 finally { button.disabled = false; confirm.disabled = false; reset.disabled = false; }
}
form.addEventListener('submit', async event => {
 event.preventDefault(); const message = document.querySelector('input').value;
 append('You: ' + message); confirm.hidden = true;
 await send({ message }); form.reset();
});
confirm.addEventListener('click', () => send({ action: 'confirm' }));
reset.addEventListener('click', () => { id = undefined; log.textContent = ''; form.hidden = false; confirm.hidden = true; form.reset(); });
