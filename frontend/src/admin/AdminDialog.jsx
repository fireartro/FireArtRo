import * as Dialog from '@radix-ui/react-dialog';

export default function AdminDialog({ title, description, open, onOpenChange, children }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="cms-dialog-overlay" />
      <Dialog.Content className="cms-dialog admin-shell">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
        {children}
        <Dialog.Close className="admin-button cms-dialog-close" aria-label="Închide dialogul">×</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
