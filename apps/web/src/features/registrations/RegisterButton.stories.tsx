import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { User } from '../../api/types';
import { meQueryKey } from '../auth/api';
import { RegisterButton } from './RegisterButton';

const participant: User = {
  id: 'u1',
  email: 'participant1@eventhub.test',
  firstName: 'Participant',
  lastName: '1',
  role: 'PARTICIPANT',
};

const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
const past = new Date(Date.now() - 7 * 86_400_000).toISOString();

/** Session simulée dans le cache : les états statiques ne nécessitent pas l'API. */
function withSession(user: User | null) {
  return (Story: () => React.JSX.Element) => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(meQueryKey, user);
    return (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    );
  };
}

const meta = {
  title: 'Inscriptions/RegisterButton',
  component: RegisterButton,
  args: {
    event: {
      id: 'evt-1',
      title: 'Meetup TypeScript',
      startsAt: future,
      isFull: false,
      isCancelled: false,
    },
  },
} satisfies Meta<typeof RegisterButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Visiteur: Story = { decorators: [withSession(null)] };
export const Connecte: Story = { decorators: [withSession(participant)] };
export const ListeAttente: Story = {
  decorators: [withSession(participant)],
  args: {
    event: {
      id: 'evt-1',
      title: 'Meetup TypeScript',
      startsAt: future,
      isFull: true,
      isCancelled: false,
    },
  },
};
export const Termine: Story = {
  decorators: [withSession(participant)],
  args: {
    event: {
      id: 'evt-1',
      title: 'Meetup TypeScript',
      startsAt: past,
      isFull: false,
      isCancelled: false,
    },
  },
};
export const Annule: Story = {
  decorators: [withSession(participant)],
  args: {
    event: {
      id: 'evt-1',
      title: 'Meetup TypeScript',
      startsAt: future,
      isFull: false,
      isCancelled: true,
    },
  },
};
