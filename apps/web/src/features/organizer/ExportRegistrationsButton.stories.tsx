import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ExportRegistrationsButton } from './ExportRegistrationsButton';

/**
 * Bouton d'export des inscrits (US13). Storybook n'a pas d'API : un clic affiche le message
 * « serveur injoignable » (ou télécharge le fichier si une API tourne sur la même origine).
 */
const meta = {
  title: 'Organisateur/ExportRegistrationsButton',
  component: ExportRegistrationsButton,
  args: { eventId: '3f0c1a52-6a3e-4b8e-9a43-0d7f1e2b9c11' },
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ExportRegistrationsButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AuRepos: Story = {};
