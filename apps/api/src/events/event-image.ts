import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { ValidationException } from '../common/errors/validation.exception.js';

/** Champ multipart attendu par `POST /events/{id}/image`. */
export const IMAGE_FIELD = 'image';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const IMAGE_MESSAGES = {
  required: "L'image est obligatoire",
  format: "L'image doit être au format JPG ou PNG",
  tooLarge: "L'image ne doit pas dépasser 2 Mo",
  invalidUpload: 'Envoyez une seule image dans le champ « image », au format multipart/form-data',
  notOrganizer: "Seul l'organisateur de l'événement peut modifier son image",
} as const;

/** Fichier reçu par multer (stockage en mémoire). */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Type réel d'une image d'après ses premiers octets, sans se fier à l'extension
 * ni au `Content-Type` annoncés par le client. `null` si ce n'est ni un PNG ni un JPEG.
 */
export function detectImageType(content: Buffer): 'png' | 'jpg' | null {
  if (content.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return 'png';
  if (content.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) return 'jpg';
  return null;
}

/** Vérifie l'image reçue et renvoie l'extension à utiliser pour la stocker. */
export function validateImage(image: UploadedImage | undefined): 'png' | 'jpg' {
  const fail = (message: string) => new ValidationException([{ field: IMAGE_FIELD, message }]);
  if (!image) throw fail(IMAGE_MESSAGES.required);
  if (image.size > MAX_IMAGE_BYTES) throw fail(IMAGE_MESSAGES.tooLarge);
  const type = detectImageType(image.buffer);
  if (!type) throw fail(IMAGE_MESSAGES.format);
  return type;
}

const MulterImageInterceptor = FileInterceptor(IMAGE_FIELD, {
  // Au-delà de 2 Mo, multer interrompt la lecture : le fichier n'est jamais gardé en mémoire.
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
});

/**
 * Lit le champ multipart `image` en mémoire et traduit les refus de multer
 * (fichier trop gros, champ inattendu, corps mal formé) en 400 au format commun.
 */
@Injectable()
export class ImageUploadInterceptor extends MulterImageInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    try {
      return await super.intercept(context, next);
    } catch (error) {
      if (error instanceof PayloadTooLargeException) {
        throw new ValidationException([{ field: IMAGE_FIELD, message: IMAGE_MESSAGES.tooLarge }]);
      }
      if (error instanceof BadRequestException) {
        throw new ValidationException([
          { field: IMAGE_FIELD, message: IMAGE_MESSAGES.invalidUpload },
        ]);
      }
      throw error;
    }
  }
}
