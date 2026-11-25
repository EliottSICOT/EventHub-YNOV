import { CreateEventDto } from './create-event.dto.js';

/**
 * Corps de `PUT /events/{id}` (US09) : remplace tous les champs, avec les validations de la
 * création. Un champ facultatif absent (`endsAt`, `address`) est effacé.
 */
export class UpdateEventDto extends CreateEventDto {}
