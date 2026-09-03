import AdminGate from '@/admin/AdminGate';
import AdminLayout from '@/admin/AdminLayout';
import { AdminDraftProvider } from '@/admin/AdminDraftContext';
import { AdminSessionProvider } from '@/admin/AdminSessionContext';
import '@/admin.css';

export default function AdminPage() {
  return <AdminSessionProvider><AdminGate><AdminDraftProvider><AdminLayout /></AdminDraftProvider></AdminGate></AdminSessionProvider>;
}
