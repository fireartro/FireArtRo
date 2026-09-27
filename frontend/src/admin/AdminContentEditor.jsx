import { useState } from 'react';
import { ADMIN_MODULES, makeAdminItem } from './adminConfig';
import { useAdminDraft } from './AdminDraftContext';
import AdminField from './AdminField';
import AdminDialog from './AdminDialog';

const technical = new Set(['id','width','height','aspectRatio']);

export default function AdminContentEditor({ moduleKey }) {
  const definition = ADMIN_MODULES[moduleKey];
  const { draft, update, undo } = useAdminDraft();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [removal, setRemoval] = useState(false);
  const [editing, setEditing] = useState(false);
  const items = definition.kind === 'collection' ? draft[moduleKey] : null;
  const title = item => item?.[definition.titleKey] || 'Fără nume';
  const visible = items?.filter(item => `${title(item)} ${item[definition.subtitleKey] || ''}`.toLocaleLowerCase('ro-RO').includes(query.trim().toLocaleLowerCase('ro-RO')));
  // A name edit can remove a record from the filter; never silently edit its neighbour.
  const current = selected ? items?.find(item => item.id === selected) : visible?.[0];
  const index = current ? items.indexOf(current) : -1;
  const search = value => { setQuery(value); setSelected(null); setEditing(false); };
  const pinCurrent = () => { if (items && current && selected !== current.id) setSelected(current.id); };
  const open = item => { setSelected(item.id); setEditing(true); };
  const add = () => { const item = makeAdminItem(moduleKey, items.length); update(moduleKey, [...items, item]); setQuery(''); open(item); };
  const duplicate = () => { const item = { ...JSON.parse(JSON.stringify(current)), id: makeAdminItem(moduleKey, items.length).id, ...('order' in current ? {order:items.length + 1} : {}) }; update(moduleKey, [...items, item]); setQuery(''); open(item); };
  const thumbnail = item => {
    const media = draft.mediaItems.find(entry => entry.id === (item.logoMediaId || item.imageMediaId || item.mediaId));
    return item.thumbnail || (media?.type === 'image' ? media.thumbnail || media.src : media?.poster);
  };
  const move = delta => {
    const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(moduleKey, next.map((item, position) => 'order' in item ? { ...item, order: position + 1 } : item)); setSelected(current.id);
  };
  return <section className="cms-panel">
    <header className="cms-panel-heading"><div><h1>{definition.label}</h1><p>{definition.description}</p></div><button className="admin-button" onClick={undo}>Anulează ultima modificare</button></header>
    <div className={items ? 'cms-collection' : ''} data-view={editing && current ? 'editor' : 'list'}>
      {items && <aside className="cms-collection-list"><label>Caută în {definition.label.toLowerCase()}<input value={query} onChange={event => search(event.target.value)} type="search" /></label>
        <button className="admin-button" onClick={add}>Adaugă element</button>
        <small className="cms-collection-count">{visible.length} / {items.length} elemente</small>
        <ul className="cms-collection-results">{visible.map(item => <li key={item.id}><button
          className={`cms-collection-choice ${item === current ? 'is-active' : ''}`} aria-current={item === current ? 'true' : undefined} onClick={() => open(item)}>
          {thumbnail(item) && <img src={thumbnail(item)} alt="" loading="lazy" width="48" height="48"/>}<span><strong>{title(item)}</strong><small>{item[definition.subtitleKey]}</small></span></button></li>)}</ul>
        {!visible.length && <div className="cms-empty-state" role="status"><p>{items.length ? 'Niciun rezultat pentru această căutare.' : 'Nu există elemente.'}</p>{query && <button className="admin-button" onClick={()=>search('')}>Șterge căutarea</button>}</div>}
      </aside>}
      <div className="cms-editor-fields" onFocusCapture={pinCurrent} onChangeCapture={pinCurrent}>{items && current && <><div className="cms-editor-title"><button className="admin-button cms-back-to-list" onClick={()=>setEditing(false)}>Înapoi la listă</button><h2>{title(current)}</h2></div><div className="cms-row-actions">
        <button className="admin-button" disabled={!index} onClick={() => move(-1)} aria-label="Mută în sus">↑</button>
        <button className="admin-button" disabled={index === items.length - 1} onClick={() => move(1)} aria-label="Mută în jos">↓</button>
        <button className="admin-button" onClick={duplicate}>Duplică</button><button className="admin-button is-danger-quiet" onClick={() => setRemoval(true)}>Șterge</button>
      </div></>}
        {items && !current ? null : <div className="cms-form-grid">
          {definition.fields.filter(field => !items || !technical.has(field.key)).map(field => <AdminField key={`${current?.id || moduleKey}-${field.key}`} field={field} path={`${moduleKey}${items ? `.${index}` : ''}.${field.key}`} />)}
          {items && <details className="cms-technical-fields"><summary>Detalii tehnice</summary><div className="cms-form-grid">{definition.fields.filter(field=>technical.has(field.key)).map(field=><AdminField key={`${current.id}-${field.key}`} field={field} path={`${moduleKey}.${index}.${field.key}`}/>)}</div></details>}
        </div>}
      </div>
    </div>
    <AdminDialog open={removal} onOpenChange={setRemoval} title="Șterge din draft" description={`Elimini „${title(current)}”? Poți anula modificarea înainte de publicare.`}>
      <button className="admin-button is-danger-quiet" onClick={() => { update(moduleKey, items.filter((_, itemIndex) => itemIndex !== index)); setSelected(null); setRemoval(false); setEditing(false); }}>Șterge elementul</button>
    </AdminDialog>
  </section>;
}
