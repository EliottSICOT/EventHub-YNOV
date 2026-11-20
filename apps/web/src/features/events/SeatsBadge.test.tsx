import { render, screen } from '@testing-library/react';
import { SeatsBadge } from './SeatsBadge';

describe('SeatsBadge', () => {
  it('affiche « Complet » quand il ne reste plus de place', () => {
    render(<SeatsBadge remainingSeats={0} capacity={50} isFull />);
    expect(screen.getByText('Complet')).toHaveClass('badge--full');
  });

  it('signale une jauge presque pleine', () => {
    render(<SeatsBadge remainingSeats={3} capacity={50} isFull={false} />);
    expect(screen.getByText('3 places restantes')).toHaveClass('badge--low');
  });

  it('affiche les places restantes', () => {
    render(<SeatsBadge remainingSeats={30} capacity={50} isFull={false} />);
    expect(screen.getByText('30 places restantes')).toHaveClass('badge--ok');
  });
});
