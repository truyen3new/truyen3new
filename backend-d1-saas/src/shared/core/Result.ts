export class Success<T> {
  constructor(public readonly value: T) {}
}

export class Failure<E extends Error = Error> {
  constructor(public readonly error: E) {}
}

export type Result<T, E extends Error = Error> = Success<T> | Failure<E>;
