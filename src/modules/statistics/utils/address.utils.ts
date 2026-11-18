/** Recorte de endereço que as estatísticas expõem. */
export interface AddressSummary {
  city?: string;
  state?: string;
  district?: string;
  street?: string;
}

/** Campos de endereço lidos com segurança de qualquer entidade que os tenha. */
type AddressLike = Partial<
  Record<'city' | 'state' | 'district' | 'street', string | null>
>;

/**
 * Endereço no formato das estatísticas.
 *
 * O endereço do clubinho é uma relação opcional: um clubinho cadastrado sem
 * endereço derrubava `GET /statistics/clubs` inteiro com erro interno ao ler
 * `club.address.city`. Sem endereço, todos os campos saem indefinidos.
 */
export function toAddressSummary(
  address: AddressLike | null | undefined,
): AddressSummary {
  return {
    city: address?.city ?? undefined,
    state: address?.state ?? undefined,
    district: address?.district ?? undefined,
    street: address?.street ?? undefined,
  };
}
