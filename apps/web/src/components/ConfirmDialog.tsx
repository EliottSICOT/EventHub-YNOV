import { AlertDialog, Button } from '@heroui/react';
import { useId, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Action en cours : les boutons sont désactivés et la fermeture est bloquée. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Boîte de confirmation modale (`alertdialog`), sur l'AlertDialog de HeroUI (React Aria) :
 * le focus arrive sur le bouton sûr (celui qui renonce), reste dans la boîte, Échap ou un clic
 * à l'extérieur renonce, et le focus revient à l'élément d'origine à la fermeture.
 * Le parent n'affiche la boîte que lorsqu'il faut confirmer.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const descriptionId = useId();

  return (
    <AlertDialog.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
      }}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog
          className="sm:max-w-md"
          aria-describedby={children ? descriptionId : undefined}
        >
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" aria-hidden="true" />
            <AlertDialog.Heading level={2}>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          {children && (
            <AlertDialog.Body
              id={descriptionId}
              className="text-sm leading-relaxed text-foreground"
            >
              {children}
            </AlertDialog.Body>
          )}
          <AlertDialog.Footer>
            <Button variant="tertiary" autoFocus isDisabled={pending} onPress={onCancel}>
              {cancelLabel}
            </Button>
            <Button variant="danger" isDisabled={pending} onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
