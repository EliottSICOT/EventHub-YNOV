import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusMessage } from './StatusMessage';

const meta = { title: 'Commun/StatusMessage', component: StatusMessage } satisfies Meta<
  typeof StatusMessage
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = { args: { title: 'Aucun événement' } };
export const Erreur: Story = {
  args: {
    variant: 'error',
    title: 'Impossible de charger les événements',
    children: <p>Vérifiez votre connexion puis réessayez.</p>,
  },
};
