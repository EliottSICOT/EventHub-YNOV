import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { categories } from '../../mocks/fixtures';
import { EventFilters } from './EventFilters';

const meta = {
  title: 'Événements/EventFilters',
  component: EventFilters,
  args: { categories, onChange: fn(), onReset: fn() },
} satisfies Meta<typeof EventFilters>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SansFiltre: Story = { args: { value: {} } };
export const RechercheEtTri: Story = { args: { value: { q: 'jazz', sort: '-price' } } };
export const FiltresActifs: Story = {
  args: { value: { from: '2026-12-01', to: '2026-12-31', category: 'concert', city: 'Lyon' } },
};
