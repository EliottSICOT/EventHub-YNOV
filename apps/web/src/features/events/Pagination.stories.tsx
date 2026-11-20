import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Pagination } from './Pagination';

const meta = {
  title: 'Événements/Pagination',
  component: Pagination,
  args: { onPageChange: fn() },
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PremierePage: Story = { args: { page: 1, totalPages: 4 } };
export const PageIntermediaire: Story = { args: { page: 2, totalPages: 4 } };
export const DernierePage: Story = { args: { page: 4, totalPages: 4 } };
