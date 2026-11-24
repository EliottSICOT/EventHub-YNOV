import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Préfixe public des fichiers envoyés, servis en statique hors de `/api/v1`. */
export const UPLOADS_ROUTE = '/uploads';

/**
 * Dossier des fichiers envoyés : `UPLOADS_DIR`, relatif au dossier de l'API (`apps/api`)
 * s'il n'est pas absolu ; par défaut `apps/api/uploads`.
 */
export function resolveUploadsDir(value: string | undefined = process.env.UPLOADS_DIR): string {
  return resolve(value?.trim() || 'uploads');
}

/** Écrit les images des événements dans `UPLOADS_DIR`, sous un nom aléatoire. */
@Injectable()
export class UploadStorage {
  private readonly logger = new Logger(UploadStorage.name);
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolveUploadsDir(config.get<string>('UPLOADS_DIR'));
  }

  /** Enregistre le fichier sous `<uuid>.<extension>` et renvoie son URL publique. */
  async save(content: Buffer, extension: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${extension}`;
    await writeFile(join(this.dir, name), content);
    return `${UPLOADS_ROUTE}/${name}`;
  }

  /** Supprime un fichier précédemment enregistré ; une URL externe ou un fichier absent est ignoré. */
  async remove(url: string | null): Promise<void> {
    if (!url?.startsWith(`${UPLOADS_ROUTE}/`)) return;
    // `basename` empêche de sortir du dossier, même avec une URL forgée en base.
    const file = join(this.dir, basename(url));
    try {
      await unlink(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Impossible de supprimer l'ancienne image ${basename(url)}`);
      }
    }
  }
}
