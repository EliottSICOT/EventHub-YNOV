import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SignInForm } from './SignInForm';

const meta = {
  title: 'Authentification/SignInForm',
  component: SignInForm,
  args: { onSubmit: fn() },
  decorators: [
    (Story) => (
      <div className="auth">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SignInForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Vide: Story = {};

export const IdentifiantsInvalides: Story = {
  args: { serverErrors: { fields: {}, form: 'Email ou mot de passe incorrect' } },
};

export const EnvoiEnCours: Story = {
  args: { submitting: true, defaultEmail: 'participant1@eventhub.test' },
};
