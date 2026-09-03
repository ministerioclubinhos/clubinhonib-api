import { ContactEntity } from './entities/contact.entity';
import { ContactResponseDto } from './dto/contact-response.dto';

/** Carimbo de data em ISO, venha ele como `Date` ou já como texto. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Contrato de resposta de `/contact`. */
export function toContactResponse(contact: ContactEntity): ContactResponseDto {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    message: contact.message,
    read: contact.read,
    createdAt: toIsoString(contact.createdAt),
    updatedAt: toIsoString(contact.updatedAt),
  };
}
