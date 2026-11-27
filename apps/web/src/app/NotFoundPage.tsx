import { Link } from 'react-router';
import { StatusMessage } from '../components/StatusMessage';
import { textLink } from '../components/ui';
import { useDocumentTitle } from './useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  return (
    <StatusMessage title="Page introuvable">
      <Link to="/events" className={textLink}>
        Voir les événements
      </Link>
    </StatusMessage>
  );
}
