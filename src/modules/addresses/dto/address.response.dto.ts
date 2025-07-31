import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AddressResponseDto {
  @Expose()
  id: string;

  @Expose()
  street: string;

  @Expose()
  number?: string;

  @Expose()
  district: string;

  @Expose()
  city: string;

  @Expose()
  state: string;

  @Expose()
  postalCode: string;

  @Expose()
  complement?: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
