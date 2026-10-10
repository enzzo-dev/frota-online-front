import { Pipe, PipeTransform } from '@angular/core';
import { parseUtc } from '../../core/util/dates';

/** Reads an API timestamp as UTC. Chain it with `date`: `{{ value | utc | date: 'dd/MM HH:mm' }}`. */
@Pipe({ name: 'utc' })
export class UtcPipe implements PipeTransform {
  transform(value: string | null | undefined): Date | null {
    return value ? parseUtc(value) : null;
  }
}
