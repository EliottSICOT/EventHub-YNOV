import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import '../src/index.css';

const preview: Preview = {
  // Les cartes contiennent des liens : on fournit un routeur en mémoire.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ padding: 16, maxWidth: 1120 }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: { layout: 'fullscreen' },
};

export default preview;
