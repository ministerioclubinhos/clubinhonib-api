import { TransformFnParams } from 'class-transformer';

export const parseStrictBoolean = ({ value }: TransformFnParams): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};
