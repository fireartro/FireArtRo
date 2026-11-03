import { useEffect, useRef, useState } from 'react';
import { useAdminDraft } from './AdminDraftContext';
import AdminDialog from './AdminDialog';
import {makeAdminId} from './adminConfig';
import AdminMediaPicker from './AdminMediaPicker';
import AdminImageFrame from './AdminImageFrame';
import AdminHomeVisuals from './AdminHomeVisuals';
import { DEFAULT_IMAGE_FRAME } from '@/lib/imageFrame';
import { selectHomeGallery } from '@/lib/homeMediaSelection';
import { setContentPath } from './draftStore';

const newId = makeAdminId;
export function getContentPath(value, path) { return path.split('.').reduce((current, key) => current?.[key], value); }

function effectiveMedia(draft,parent,parentPath,sourceKey) {
  if(sourceKey === 'mediaId' && parentPath.startsWith('homePage.promoSlides.') && parent?.mediaSelection !== 'manual') {
    return selectHomeGallery(draft.homePage.promoSlides,draft.mediaItems).find(slide=>slide.id === parent?.id)?.media;
  }
  return draft.mediaItems.find(item=>item.id === parent?.[sourceKey]);
}

function FieldGroup({field,path,errors}) {
  const hasError=errors.some(error=>error.path.startsWith(`${path}.`));
  const [open,setOpen]=useState(Boolean(field.open || hasError));
  useEffect(()=>{if(hasError)setOpen(true);},[hasError]);
  return <details className="cms-field-group cms-field-disclosure" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{field.label}</summary><div className="cms-form-grid">{field.fields.map(child=><AdminField key={child.key} field={child} path={`${path}.${child.key}`}/>)}</div>
  </details>;
}

function ArrayInput({ value, onChange, field, common }) {
  const separator = field.type === 'tags' ? ', ' : '\n';
  const [buffer, setBuffer] = useState((value || []).join(separator));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setBuffer((value || []).join(separator)); }, [value, separator]);
  return <textarea {...common} rows={field.rows || 4} value={buffer} onFocus={() => { focused.current = true; }}
    onBlur={() => { focused.current = false; setBuffer((value || []).join(separator)); }} onChange={event => {
      setBuffer(event.target.value);
      onChange(event.target.value.split(field.type === 'tags' ? ',' : /\r?\n/).map(item => item.trim()).filter(Boolean));
    }} />;
}

function NestedCollection({ field, value = [], onChange, path }) {
  const [removal, setRemoval] = useState(null);
  const title = item => item[field.titleKey || 'title'] || item.label || item.heading || item.id || 'Element';
  const move = (index, direction) => { const next = [...value]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; onChange(next); };
  return <fieldset className="cms-field-group"><legend>{field.label}</legend>
    {value.map((item, index) => <details key={item.id || index} className="cms-nested-item" open={index === 0}>
      <summary>{title(item)}</summary>
      <div className="cms-form-grid">{field.fields.map(child => <AdminField key={child.key} field={child} path={`${path}.${index}.${child.key}`} />)}</div>
      <div className="cms-row-actions">
        <button className="admin-button" disabled={!index} onClick={() => move(index, -1)} aria-label={`Mută ${title(item)} în sus`}>↑</button>
        <button className="admin-button" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Mută ${title(item)} în jos`}>↓</button>
        <button className="admin-button" onClick={() => onChange([...value, { ...JSON.parse(JSON.stringify(item)), id: newId(field.template?.id) }])}>Duplică</button>
        <button className="admin-button is-danger-quiet" onClick={() => setRemoval(index)}>Șterge</button>
      </div>
    </details>)}
    <button className="admin-button" onClick={() => onChange([...value, { ...JSON.parse(JSON.stringify(field.template || {})), id: newId(field.template?.id) }])}>Adaugă element</button>
    <AdminDialog open={removal !== null} onOpenChange={open => { if (!open) setRemoval(null); }} title="Șterge din draft"
      description={`Elimini „${removal !== null ? title(value[removal] || {}) : ''}”? Poți anula modificarea din editor.`}>
      <button className="admin-button is-danger-quiet" onClick={() => { onChange(value.filter((_, index) => index !== removal)); setRemoval(null); }}>Șterge elementul</button>
    </AdminDialog>
  </fieldset>;
}

export default function AdminField({ field, path }) {
  const { draft, update, errors } = useAdminDraft();
  const value = getContentPath(draft, path);
  const onChange = next => update(path, next);
  const id = `cms-field-${path}`;
  const error = errors.find(item => item.path === path)?.message;
  const common = { id, name: path, required: field.required, readOnly: field.readOnly, 'aria-invalid': Boolean(error), 'aria-describedby': error ? `${id}-error` : undefined };
  if (field.type === 'homeVisuals') return <AdminHomeVisuals/>;
  if (field.type === 'imageFrame') {
    const parentPath=path.split('.').slice(0,-1).join('.');
    const parent=getContentPath(draft,parentPath);
    const media=field.sourceKey ? effectiveMedia(draft,parent,parentPath,field.sourceKey) : parent;
    if(parent?.type && !['image','promotion','promo'].includes(parent.type)) return null;
    return <AdminImageFrame label={field.label} src={media?.type === 'image' ? (field.surface === 'gallery' ? media.thumbnail || media.src : media.src) : media?.poster} value={value} surface={field.surface} target={parent?.id} onChange={next=>{
      if(field.sourceKey && media) {
        const placement={...parent,[field.sourceKey]:media.id,mediaSelection:'manual',imageFrame:next};
        if(draft.mediaItems.some(item=>item.id === media.id)) update(parentPath,placement);
        else update('',{...setContentPath(draft,parentPath,placement),mediaItems:[...draft.mediaItems,media]});
      }
      else onChange(next);
    }}/>;
  }
  if (field.type === 'object' || (field.fields && field.type !== 'collection')) return <FieldGroup field={field} path={path} errors={errors}/>;
  if (field.type === 'collection') return <NestedCollection field={field} value={value} onChange={onChange} path={path} />;
  return <div className={`admin-field ${['textarea', 'lines', 'image'].includes(field.type) ? 'admin-field-wide' : ''}`}>
    <label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</label>
    {field.help && <small>{field.help}</small>}
    {field.type === 'checkbox' ? <input {...common} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} />
      : ['lines', 'tags'].includes(field.type) ? <ArrayInput common={common} field={field} value={value} onChange={onChange} />
      : field.type === 'textarea' ? <textarea {...common} rows={field.rows || 4} value={value ?? ''} onChange={event => onChange(event.target.value)} />
      : field.type === 'mediaId' ? <AdminMediaPicker id={id} label={field.label} value={field.framing ? effectiveMedia(draft,getContentPath(draft,path.split('.').slice(0,-1).join('.')),path.split('.').slice(0,-1).join('.'),field.key)?.id || value : value} items={draft.mediaItems} imageOnly={field.imageOnly} onChange={next=>{
        if(field.framing) {
          const parentPath=path.split('.').slice(0,-1).join('.');
          const parent=getContentPath(draft,parentPath);
          update(parentPath,{...parent,[field.key]:next,mediaSelection:next ? 'manual' : null,imageFrame:next ? parent.imageFrame || {desktop:{...DEFAULT_IMAGE_FRAME}} : null});
        } else onChange(next);
      }}/>
      : field.type === 'select' ? <select {...common} value={value ?? ''} onChange={event => onChange(event.target.value)}>{(field.options || []).map(option => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select>
      : <input {...common} type={field.type === 'number' ? 'number' : field.type === 'media' ? 'url' : field.inputType || 'text'} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder}
        value={value ?? ''} onChange={event => onChange(field.type === 'number' ? event.target.value === '' ? null : Number(event.target.value) : event.target.value)} />}
    {error && <small id={`${id}-error`} role="alert" className="cms-error">{error}</small>}
  </div>;
}
