import type { Meta, StoryObj } from '@storybook/react-vite';
import { events } from '../../mocks/fixtures';
import { EventCard } from './EventCard';

const meta = {
  title: 'Événements/EventCard',
  component: EventCard,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EventCard>;
export default meta;
type Story = StoryObj<typeof meta>;

const available = events.find((e) => !e.isFull && e.remainingSeats > 10)!;

export const Disponible: Story = { args: { event: available } };
export const Complet: Story = { args: { event: events.find((e) => e.isFull)! } };
export const TitreLong: Story = {
  args: {
    event: {
      ...available,
      title: 'Conférence internationale sur les usages responsables de l’intelligence artificielle',
    },
  },
};
