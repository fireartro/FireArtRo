import { useState } from 'react';
import AdminDialog from './AdminDialog';
import { useAdminDraft } from './AdminDraftContext';
import { ADMIN_MODULES } from './adminConfig';

export default function AdminPublishDialog({ open, onOpenChange }) {
  const { changedModules, publish, status, dirty, pendingUploads } = useAdminDraft();
  const [summary, setSummary] = useState('');
  const [success, setSuccess] = useState(false);
  const canPublish = status === 'saved' && !dirty && !pendingUploads && changedModules.length > 0;
  return <AdminDialog open={open} onOpenChange={onOpenChange} title="Publică modificările"
    description="Aceste secțiuni vor fi actualizate pentru toți vizitatorii după publicare.">
    <ul className="cms-change-list">{changedModules.map(key => <li key={key}>{ADMIN_MODULES[key]?.label || key}</li>)}</ul>
    <label className="admin-field">Notă pentru istoricul versiunilor (opțional)
      <textarea value={summary} maxLength={240} rows={3} onChange={event => setSummary(event.target.value)} />
    </label>
    {success && <p role="status">Modificările au fost publicate.</p>}
    <button className="admin-button is-primary" disabled={!canPublish} onClick={async () => {
      if (await publish(summary)) { setSuccess(true); setSummary(''); onOpenChange(false); }
    }}>{status === 'publishing' ? 'Se publică…' : 'Publică acum'}</button>
    {!canPublish && status !== 'publishing' && !success && <p>Finalizează salvarea și corectează câmpurile semnalate înainte de publicare.</p>}
  </AdminDialog>;
}
