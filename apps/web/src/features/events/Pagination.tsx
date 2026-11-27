import { Button } from '@heroui/react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
      <Button variant="outline" isDisabled={page <= 1} onPress={() => onPageChange(page - 1)}>
        Précédent
      </Button>
      <span className="text-sm font-semibold text-foreground">
        Page {page} sur {totalPages}
      </span>
      <Button
        variant="outline"
        isDisabled={page >= totalPages}
        onPress={() => onPageChange(page + 1)}
      >
        Suivant
      </Button>
    </nav>
  );
}
