import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SignUpForm } from './SignUpForm';

const meta = {
  title: 'Authentification/SignUpForm',
  component: SignUpForm,
  args: { onSubmit: fn() },
  decorators: [
    (Story) => (
      <div className="auth">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SignUpForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = {};

export const EmailDejaUtilise: Story = {
  args: {
    serverErrors: {
      fields: {
        email:
          'Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.',
      },
    },
  },
};

export const ErreursDuServeur: Story = {
  args: {
    serverErrors: {
      fields: {
        firstName: 'Le prénom ne doit pas dépasser 100 caractères',
        password: 'Le mot de passe doit contenir au moins 8 caractères',
      },
    },
  },
};

export const EnvoiEnCours: Story = { args: { submitting: true } };
