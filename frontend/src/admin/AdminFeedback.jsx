import {useState} from 'react';
import {useAdminDraft} from './AdminDraftContext';
import {ADMIN_MODULES} from './adminConfig';
import AdminDialog from './AdminDialog';

export default function AdminFeedback({onNavigate}) {
  const draft=useAdminDraft();
  const [reload,setReload]=useState(false);
  const invalid=draft.errors || [];
  if (!draft.error && !invalid.length && !draft.pendingUploads) return null;
  return <>
    {draft.pendingUploads > 0 && <p className="cms-notice" role="status">Se încarcă {draft.pendingUploads} fișiere. Publicarea este disponibilă după finalizare.</p>}
    {(draft.error || invalid.length > 0) && <section className="cms-notice is-error" role="alert">
      {draft.error && <strong>{draft.error}</strong>}
      {invalid.length > 0 && <><strong>{invalid.length} câmpuri trebuie corectate înainte de publicare.</strong><ul>{invalid.map((error,index)=>{
        const moduleKey=error.path?.split('.')[0];
        return <li key={`${error.path}-${index}`}>{ADMIN_MODULES[moduleKey] && <button className="admin-button" onClick={()=>onNavigate(moduleKey)}>{ADMIN_MODULES[moduleKey].label}</button>} {error.path}: {error.message}</li>;
      })}</ul></>}
      {draft.status === 'conflict' ? <button className="admin-button" onClick={()=>setReload(true)}>Încarcă versiunea serverului</button> : draft.error && <button className="admin-button" onClick={draft.retry}>Încearcă din nou</button>}
    </section>}
    <AdminDialog open={reload} onOpenChange={setReload} title="Încarcă draftul de pe server" description="Modificările locale nesalvate vor fi înlocuite. Verifică înainte de a continua.">
      <button className="admin-button is-danger-quiet" onClick={()=>{draft.reloadAfterConflict();setReload(false);}}>Înlocuiește modificările locale</button>
    </AdminDialog>
  </>;
}
