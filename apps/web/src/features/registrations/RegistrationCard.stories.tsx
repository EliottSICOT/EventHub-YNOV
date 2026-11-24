import type { Meta, StoryObj } from '@storybook/react-vite';
import { createEvents } from '../../mocks/fixtures';
import { RegistrationCard } from './RegistrationCard';

const { description: _d, address: _a, organizer: _o, ...event } = createEvents()[1];

const meta = {
  title: 'Inscriptions/RegistrationCard',
  component: RegistrationCard,
  args: { registration: { id: 'reg-1', createdAt: new Date().toISOString(), event } },
} satisfies Meta<typeof RegistrationCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ParDefaut: Story = {};
