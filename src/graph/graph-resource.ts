import { GraphTransport, HttpMethod } from './graph-transport';

/**
 * Keys of `T` that Microsoft Graph can return via `$select`. Navigation
 * properties (objects and collections) need `$expand` instead, so they are
 * excluded. Complex types are objects too and are therefore excluded by default;
 * a resource declares any it genuinely supports via the `Complex` parameter.
 */
type ScalarKey<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends object ? never : K;
}[keyof T];

export type SelectableKey<T, Complex extends keyof T = never> = (ScalarKey<T> | Complex) & keyof T;

/**
 * A single Microsoft Graph entity.
 *
 * `Selected` tracks which fields were requested, so reading a field that was not
 * selected is a compile error rather than an `undefined` at runtime. Note that
 * selected fields stay optional: `$select` does not make a nullable Graph field
 * present, so callers still narrow at the boundary.
 *
 * `select` replaces any previous selection rather than adding to it, matching
 * the single `$select` query parameter it produces. Call it once with every
 * field you need.
 */
export class GraphItem<T, Complex extends keyof T = never, Selected = T> {
  constructor(
    private readonly transport: GraphTransport,
    private readonly path: string,
    private readonly scopes: readonly string[],
    private readonly selectedFields: readonly string[] = [],
  ) {}

  select<K extends SelectableKey<T, Complex>>(...fields: K[]): GraphItem<T, Complex, Pick<T, K>> {
    return new GraphItem<T, Complex, Pick<T, K>>(
      this.transport,
      this.path,
      this.scopes,
      fields as readonly string[],
    );
  }

  async get(): Promise<Selected> {
    const query =
      this.selectedFields.length > 0 ? { $select: this.selectedFields.join(',') } : undefined;

    return (await this.transport.sendForJson({
      method: HttpMethod.Get,
      path: this.path,
      scopes: this.scopes,
      query,
    })) as Selected;
  }
}
