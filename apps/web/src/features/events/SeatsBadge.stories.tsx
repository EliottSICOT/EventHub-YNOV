import type { Meta, StoryObj } from '@storybook/react-vite';
import { SeatsBadge } from './SeatsBadge';

const meta = { title: 'Événements/SeatsBadge', component: SeatsBadge } satisfies Meta<
  typeof SeatsBadge
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PlacesDisponibles: Story = {
  args: { remainingSeats: 42, capacity: 100, isFull: false },
};
export const PresqueComplet: Story = { args: { remainingSeats: 3, capacity: 100, isFull: false } };
export const DernierePlace: Story = { args: { remainingSeats: 1, capacity: 100, isFull: false } };
export const Complet: Story = { args: { remainingSeats: 0, capacity: 100, isFull: true } };
