import { useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Image, Search, X } from 'lucide-react';

export default function AdminMediaPicker({value, onChange, items, label, id, imageOnly=false, clearable=true}) {
  const [open,setOpen] = useState(false);
  const [query,setQuery] = useState('');
  const [category,setCategory] = useState('');
  const [kind,setKind] = useState('');
  const selected = items.find(item=>item.id === value);
  const available = useMemo(()=>items.filter(item=>!imageOnly || item.type === 'image'),[items,imageOnly]);
  const categories = [...new Set(available.map(item=>item.category).filter(Boolean))];
  const filtered = available.filter(item=>(!category || item.category === category) &&
    (imageOnly || !kind || (kind === 'video' ? ['video','youtube'].includes(item.type) : item.type === kind)) &&
    `${item.title} ${item.category} ${item.alt} ${item.id}`.toLocaleLowerCase('ro-RO').includes(query.trim().toLocaleLowerCase('ro-RO')));
  const preview = item => item?.type === 'image' ? item.thumbnail || item.src : item?.poster || item?.thumbnail;
  const choose = next => {onChange(next);setOpen(false);};
  return <Dialog.Root open={open} onOpenChange={next=>{setOpen(next);if(next){setQuery('');setCategory('');setKind('');}}}>
    <div className="cms-media-choice"><Dialog.Trigger id={id} className="cms-media-choice__trigger" aria-label={`Alege ${label}`}>
      {preview(selected) ? <img src={preview(selected)} alt="" width="64" height="48" loading="lazy"/> : <span className="cms-media-choice__placeholder"><Image aria-hidden="true"/></span>}
      <span><strong>{selected?.title || 'Alege un material'}</strong><small>{selected ? `${selected.category || selected.type} · Schimbă imaginea` : imageOnly ? 'Deschide biblioteca de imagini' : 'Imagini și videoclipuri din bibliotecă'}</small></span>
    </Dialog.Trigger>{value && clearable && <button type="button" className="admin-button cms-media-choice__clear" aria-label={`Elimină ${label}`} onClick={()=>onChange('')}><X aria-hidden="true"/></button>}</div>
    <Dialog.Portal><Dialog.Overlay className="cms-dialog-overlay"/><Dialog.Content className="cms-media-picker admin-shell">
      <header><div><Dialog.Title>{label}</Dialog.Title><Dialog.Description>Alege materialul folosit în acest loc. Fișierul original rămâne în bibliotecă.</Dialog.Description></div><Dialog.Close className="admin-button" aria-label="Închide biblioteca"><X aria-hidden="true"/></Dialog.Close></header>
      {selected && <div className="cms-media-picker__current" aria-label="Materialul selectat">{preview(selected) ? <img src={preview(selected)} alt="" width="52" height="40"/> : <Image aria-hidden="true"/>}<div><small>Material selectat</small><strong>{selected.title}</strong></div><Check aria-hidden="true"/></div>}
      <div className="cms-media-picker__filters"><label><Search aria-hidden="true"/><input type="search" aria-label="Caută imagini și materiale" placeholder="Caută după titlu, categorie…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <select aria-label="Filtrează după categorie" value={category} onChange={event=>setCategory(event.target.value)}><option value="">Toate categoriile</option>{categories.map(item=><option key={item}>{item}</option>)}</select>
        {!imageOnly && <select aria-label="Filtrează după tip" value={kind} onChange={event=>setKind(event.target.value)}><option value="">Toate tipurile</option><option value="image">Imagini</option><option value="video">Videoclipuri</option><option value="promo">Materiale promo</option></select>}<span role="status">{filtered.length} materiale</span></div>
      <div className="cms-media-picker__grid">{filtered.map(item=><button type="button" key={item.id} className={item.id === value ? 'is-selected' : ''} aria-label={`Selectează ${item.title}`} aria-pressed={item.id === value} onClick={()=>choose(item.id)}>
        <span className="cms-media-picker__image">{preview(item) ? <img src={preview(item)} alt="" loading="lazy" decoding="async"/> : <Image aria-hidden="true"/>}{item.id === value && <span><Check aria-hidden="true"/></span>}</span>
        <strong>{item.title}</strong><small>{item.category || item.type}</small>
      </button>)}</div>
      {!filtered.length && <div className="cms-picker-empty" role="status"><p>Nu există materiale pentru aceste filtre.</p><button className="admin-button" onClick={()=>{setQuery('');setCategory('');setKind('');}}>Resetează filtrele</button></div>}
      <footer>{clearable ? <button className="admin-button" onClick={()=>choose('')}>Fără material asociat</button> : <span/>}<Dialog.Close className="admin-button">Renunță</Dialog.Close></footer>
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
