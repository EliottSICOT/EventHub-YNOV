import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { categories } from '../../mocks/fixtures';
import { CreateEventForm } from './CreateEventForm';

const meta = {
  title: 'Organisateur/CreateEventForm',
  component: CreateEventForm,
  args: { categories, onSubmit: fn() },
  decorators: [
    (Story) => (
      <div className="organizer">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateEventForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = {};

export const ChargementDesCategories: Story = {
  args: { categories: undefined },
};

export const ErreursDuServeur: Story = {
  args: {
    serverErrors: {
      fields: {
        categoryId: "La catégorie choisie n'existe pas",
        startsAt: 'La date de début doit être dans le futur',
        image: "L'image doit être au format JPG ou PNG",
      },
    },
  },
};

export const EnvoiEnCours: Story = {
  args: { submitting: true },
};
