import { Link } from 'react-router';
import { StatusMessage } from '../components/StatusMessage';

export function NotFoundPage() {
  return (
    <StatusMessage title="Page introuvable">
      <Link to="/events">Voir les événements</Link>
    </StatusMessage>
  );
}
