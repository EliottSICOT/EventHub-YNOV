import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { ValidationException } from '../common/errors/validation.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadStorage } from '../uploads/uploads.js';
import {
  detectImageType,
  IMAGE_MESSAGES,
  MAX_IMAGE_BYTES,
  type UploadedImage,
} from './event-image.js';
import { EventImagesService } from './event-images.service.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

function upload(buffer: Buffer, name = 'affiche.png', size = buffer.length): UploadedImage {
  return { originalname: name, mimetype: 'image/png', size, buffer };
}

const savedEvent = {
  id: 'e1',
  title: 'Nuit du jazz',
  description: 'Desc',
  startsAt: new Date('2026-12-05T18:00:00.000Z'),
  endsAt: null,
  venue: 'Le Transbordeur',
  address: null,
  city: 'Lyon',
  capacity: 300,
  priceCents: 1500,
  imageUrl: '/uploads/new.png',
  category: { id: 'c1', name: 'Concert', slug: 'concert' },
  organizer: { id: 'orga', firstName: 'Camille', lastName: 'Martin' },
  _count: { registrations: 0 },
};

describe('detectImageType', () => {
  it('reconnaît un PNG et un JPEG à leurs premiers octets', () => {
    expect(detectImageType(PNG)).toBe('png');
    expect(detectImageType(JPEG)).toBe('jpg');
  });

  it("ne se fie pas à l'extension : un texte renommé en .png est refusé", () => {
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe('EventImagesService', () => {
  const prismaMock = { event: { findUnique: vi.fn(), update: vi.fn() } };
  const storageMock = { save: vi.fn(), remove: vi.fn() };
  let service: EventImagesService;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageMock.save.mockResolvedValue('/uploads/new.png');
    const moduleRef = await Test.createTestingModule({
      providers: [
        EventImagesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: UploadStorage, useValue: storageMock },
      ],
    }).compile();
    service = moduleRef.get(EventImagesService);
  });

  it("enregistre l'image, met à jour imageUrl et supprime l'ancienne", async () => {
    prismaMock.event.findUnique.mockResolvedValue({
      organizerId: 'orga',
      imageUrl: '/uploads/old.jpg',
    });
    prismaMock.event.update.mockResolvedValue(savedEvent);

    const event = await service.setImage('e1', 'orga', upload(PNG));

    expect(storageMock.save).toHaveBeenCalledWith(PNG, 'png');
    expect(prismaMock.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'e1' }, data: { imageUrl: '/uploads/new.png' } }),
    );
    expect(storageMock.remove).toHaveBeenCalledWith('/uploads/old.jpg');
    expect(event).toMatchObject({ id: 'e1', imageUrl: '/uploads/new.png' });
  });

  it("stocke un JPEG avec l'extension jpg, quel que soit le nom envoyé", async () => {
    prismaMock.event.findUnique.mockResolvedValue({ organizerId: 'orga', imageUrl: null });
    prismaMock.event.update.mockResolvedValue(savedEvent);

    await service.setImage('e1', 'orga', upload(JPEG, 'photo.png'));

    expect(storageMock.save).toHaveBeenCalledWith(JPEG, 'jpg');
  });

  it('lève une 404 pour un événement inconnu', async () => {
    prismaMock.event.findUnique.mockResolvedValue(null);
    await expect(service.setImage('inconnu', 'orga', upload(PNG))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("lève une 403 si l'utilisateur n'est pas l'organisateur de l'événement", async () => {
    prismaMock.event.findUnique.mockResolvedValue({ organizerId: 'autre', imageUrl: null });

    const attempt = service.setImage('e1', 'orga', upload(PNG));
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toMatchObject({ message: IMAGE_MESSAGES.notOrganizer });
    expect(storageMock.save).not.toHaveBeenCalled();
  });

  it.each([
    ['un fichier absent', undefined, IMAGE_MESSAGES.required],
    ['un autre format', upload(Buffer.from('GIF89a'), 'anim.png'), IMAGE_MESSAGES.format],
    [
      'un fichier de plus de 2 Mo',
      upload(PNG, 'big.png', MAX_IMAGE_BYTES + 1),
      IMAGE_MESSAGES.tooLarge,
    ],
  ])('refuse %s avec une 400 sur le champ image', async (_label, image, message) => {
    prismaMock.event.findUnique.mockResolvedValue({ organizerId: 'orga', imageUrl: null });

    const attempt = service.setImage('e1', 'orga', image);
    await expect(attempt).rejects.toBeInstanceOf(ValidationException);
    await expect(attempt).rejects.toMatchObject({ details: [{ field: 'image', message }] });
    expect(storageMock.save).not.toHaveBeenCalled();
  });

  it("supprime le fichier écrit si la mise à jour de l'événement échoue", async () => {
    prismaMock.event.findUnique.mockResolvedValue({ organizerId: 'orga', imageUrl: null });
    prismaMock.event.update.mockReturnValue(Promise.reject(new Error('base indisponible')));

    await expect(service.setImage('e1', 'orga', upload(PNG))).rejects.toThrow('base indisponible');
    expect(storageMock.remove).toHaveBeenCalledWith('/uploads/new.png');
  });
});
