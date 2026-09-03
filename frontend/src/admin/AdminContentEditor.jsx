import { useState } from 'react';
import { ADMIN_MODULES, makeAdminItem } from './adminConfig';
import { useAdminDraft } from './AdminDraftContext';
import AdminField from './AdminField';
import AdminDialog from './AdminDialog';

export default function AdminContentEditor({ moduleKey }) {
  const definition = ADMIN_MODULES[moduleKey];
  const { draft, update, undo } = useAdminDraft();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [removal, setRemoval] = useState(false);
  const items = definition.kind === 'collection' ? draft[moduleKey] : null;
  const index = items ? Math.max(0, items.findIndex(item => item.id === selected)) : -1;
  const current = items?.[index];
  const title = item => item?.[definition.titleKey] || item?.id || 'Element';
  const add = () => { const item = makeAdminItem(moduleKey, items.length); update(moduleKey, [...items, item]); setSelected(item.id); };
  const duplicate = () => { const item = { ...JSON.parse(JSON.stringify(current)), id: `${definition.template.id}-${crypto.randomUUID()}` }; update(moduleKey, [...items, item]); setSelected(item.id); };
  const move = delta => {
    const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]];
    update(moduleKey, next.map((item, position) => 'order' in item ? { ...item, order: position + 1 } : item)); setSelected(current.id);
  };
  return <section className="cms-panel">
    <header className="cms-panel-heading"><div><h1>{definition.label}</h1><p>{definition.description}</p></div><button className="admin-button" onClick={undo}>Anulează ultima modificare</button></header>
    <div className={items ? 'cms-collection' : ''}>
      {items && <aside className="cms-collection-list"><label>Caută în {definition.label.toLowerCase()}<input value={query} onChange={event => setQuery(event.target.value)} type="search" /></label>
        <button className="admin-button" onClick={add}>Adaugă element</button>
        <div role="list">{items.filter(item => `${title(item)} ${item[definition.subtitleKey] || ''}`.toLocaleLowerCase('ro-RO').includes(query.toLocaleLowerCase('ro-RO'))).map(item => <button role="listitem" key={item.id}
          className={`cms-collection-choice ${item === current ? 'is-active' : ''}`} aria-current={item === current ? 'true' : undefined} onClick={() => setSelected(item.id)}>
          <strong>{title(item)}</strong><small>{item[definition.subtitleKey]}</small></button>)}</div>
      </aside>}
      <div className="cms-editor-fields">{items && current && <div className="cms-row-actions">
        <button className="admin-button" disabled={!index} onClick={() => move(-1)} aria-label="Mută în sus">↑</button>
        <button className="admin-button" disabled={index === items.length - 1} onClick={() => move(1)} aria-label="Mută în jos">↓</button>
        <button className="admin-button" onClick={duplicate}>Duplică</button><button className="admin-button is-danger-quiet" onClick={() => setRemoval(true)}>Șterge</button>
      </div>}
        {items && !current ? <p>Nu există elemente. Adaugă primul element când este pregătit.</p> : <div className="cms-form-grid">
          {definition.fields.map(field => <AdminField key={`${current?.id || moduleKey}-${field.key}`} field={field} path={`${moduleKey}${items ? `.${index}` : ''}.${field.key}`} />)}
        </div>}
      </div>
    </div>
    <AdminDialog open={removal} onOpenChange={setRemoval} title="Șterge din draft" description={`Elimini „${title(current)}”? Poți anula modificarea înainte de publicare.`}>
      <button className="admin-button is-danger-quiet" onClick={() => { update(moduleKey, items.filter((_, itemIndex) => itemIndex !== index)); setSelected(null); setRemoval(false); }}>Șterge elementul</button>
    </AdminDialog>
  </section>;
}
