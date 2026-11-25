import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { demoUsers } from '../../mocks/auth';
import { createEvents } from '../../mocks/fixtures';
import { meQueryKey } from '../auth/api';
import { EventActions } from './EventActions';

const organizer = demoUsers[1];

const meta = {
  title: 'Organisateur/EventActions',
  component: EventActions,
  args: { event: createEvents().find((e) => e.organizer.id === organizer.id)! },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient();
      queryClient.setQueryData(meQueryKey, organizer);
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      );
    },
  ],
} satisfies Meta<typeof EventActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Organisateur: Story = {};
