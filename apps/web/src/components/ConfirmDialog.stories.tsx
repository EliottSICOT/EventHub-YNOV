import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ConfirmDialog } from './ConfirmDialog';

const meta = {
  title: 'Composants/ConfirmDialog',
  component: ConfirmDialog,
  args: {
    title: 'Annuler cette inscription ?',
    confirmLabel: 'Oui, annuler',
    cancelLabel: 'Garder mon inscription',
    onConfirm: fn(),
    onCancel: fn(),
    children: (
      <p>
        Vous allez annuler votre inscription à <strong>Meetup TypeScript</strong>. Votre place sera
        libérée pour les autres participants.
      </p>
    ),
  },
} satisfies Meta<typeof ConfirmDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Defaut: Story = {};
export const EnCours: Story = { args: { pending: true } };
