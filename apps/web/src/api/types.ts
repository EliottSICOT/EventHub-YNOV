import type { components } from './schema';

type Schemas = components['schemas'];

export type Category = Schemas['CategoryDto'];
export type EventSummary = Schemas['EventSummaryDto'];
export type EventDetail = Schemas['EventDetailDto'];
export type PaginatedEvents = Schemas['PaginatedEventsDto'];
export type ApiErrorBody = Schemas['ApiErrorDto'];
export type FieldError = Schemas['FieldErrorDto'];
export type User = Schemas['UserDto'];
export type Role = Schemas['Role'];
export type SignUpInput = Schemas['SignUpDto'];
export type SignInInput = Schemas['SignInDto'];
export type UserRegistration = Schemas['UserRegistrationDto'];
