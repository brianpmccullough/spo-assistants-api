import { SearchEntityType } from './models/search-entity-type';
import {
  ManagedPropertyType,
  QueryableField,
  RangeableField,
  SearchField,
  SearchSchema,
  SortableField,
} from './SearchSchema';

// ---- enums ----

export enum Operator {
  Contains = ':',
  Equals = '=',
  LessThan = '<',
  GreaterThan = '>',
  LessThanOrEqual = '<=',
  GreaterThanOrEqual = '>=',
  NotEqual = '<>',
}

export enum BooleanOperator {
  And = 'AND',
  Or = 'OR',
}

export enum ExpressionType {
  FreeText = 'FreeText',
  Restriction = 'Restriction',
  Range = 'Range',
  Not = 'Not',
  Group = 'Group',
}

export enum DateInterval {
  Today = 'today',
  Yesterday = 'yesterday',
  ThisWeek = 'this week',
  ThisMonth = 'this month',
  LastMonth = 'last month',
  ThisYear = 'this year',
  LastYear = 'last year',
}

// ---- operator/value constraints by type ----

type TextOperator = Operator.Contains | Operator.Equals;

type NumericOperator =
  | Operator.Contains
  | Operator.Equals
  | Operator.LessThan
  | Operator.GreaterThan
  | Operator.LessThanOrEqual
  | Operator.GreaterThanOrEqual
  | Operator.NotEqual;

type YesNoOperator = Operator.Contains | Operator.Equals | Operator.NotEqual;

type OperatorForType = {
  [ManagedPropertyType.Text]: TextOperator;
  [ManagedPropertyType.Integer]: NumericOperator;
  [ManagedPropertyType.DateTime]: NumericOperator;
  [ManagedPropertyType.YesNo]: YesNoOperator;
};

type ValueForType = {
  [ManagedPropertyType.Text]: string;
  [ManagedPropertyType.Integer]: number;
  [ManagedPropertyType.DateTime]: string | DateInterval;
  [ManagedPropertyType.YesNo]: 0 | 1;
};

// ---- expression types ----

interface PropertyRestriction<K extends QueryableField = QueryableField> {
  property: K;
  operator: OperatorForType[SearchSchema[K]['type']];
  value: ValueForType[SearchSchema[K]['type']];
}

interface RangeRestriction<K extends RangeableField = RangeableField> {
  property: K;
  from: ValueForType[SearchSchema[K]['type']];
  to: ValueForType[SearchSchema[K]['type']];
}

type Expression =
  | { type: ExpressionType.FreeText; value: string }
  | { type: ExpressionType.Restriction; restriction: PropertyRestriction }
  | { type: ExpressionType.Range; range: RangeRestriction }
  | { type: ExpressionType.Not; expression: Expression }
  | {
      type: ExpressionType.Group;
      expressions: Expression[];
      joinOperators: (BooleanOperator | undefined)[];
    };

// ---- builder ----

interface BuilderEntry {
  expression: Expression;
  joinOperator?: BooleanOperator;
}

export class KqlBuilder {
  private entries: BuilderEntry[] = [];

  where<K extends QueryableField>(
    property: K,
    operator: OperatorForType[SearchSchema[K]['type']],
    value: ValueForType[SearchSchema[K]['type']],
  ): this {
    this.entries.push({
      expression: {
        type: ExpressionType.Restriction,
        restriction: { property, operator, value },
      },
    });
    return this;
  }

  whereRange<K extends RangeableField>(
    property: K,
    from: ValueForType[SearchSchema[K]['type']],
    to: ValueForType[SearchSchema[K]['type']],
  ): this {
    this.entries.push({
      expression: {
        type: ExpressionType.Range,
        range: { property, from, to },
      },
    });
    return this;
  }

  freetext(text: string): this {
    this.entries.push({
      expression: { type: ExpressionType.FreeText, value: text },
    });
    return this;
  }

  not<K extends QueryableField>(
    property: K,
    operator: OperatorForType[SearchSchema[K]['type']],
    value: ValueForType[SearchSchema[K]['type']],
  ): this {
    this.entries.push({
      expression: {
        type: ExpressionType.Not,
        expression: {
          type: ExpressionType.Restriction,
          restriction: { property, operator, value },
        },
      },
    });
    return this;
  }

  group(fn: (subBuilder: KqlBuilder) => KqlBuilder): this {
    const subBuilder = new KqlBuilder();
    fn(subBuilder);
    this.entries.push({
      expression: {
        type: ExpressionType.Group,
        expressions: subBuilder.entries.map((entry) => entry.expression),
        joinOperators: subBuilder.entries.map((entry) => entry.joinOperator),
      },
    });
    return this;
  }

  and(): this {
    if (this.entries.length) {
      this.entries[this.entries.length - 1].joinOperator = BooleanOperator.And;
    }
    return this;
  }

  or(): this {
    if (this.entries.length) {
      this.entries[this.entries.length - 1].joinOperator = BooleanOperator.Or;
    }
    return this;
  }

  build(): string {
    return this.serializeEntries(this.entries);
  }

  private serializeEntries(entries: BuilderEntry[]): string {
    return entries
      .map((entry, index) => {
        const serialized = this.serialize(entry.expression);
        if (index === 0) return serialized;
        const operator = entries[index - 1].joinOperator ?? BooleanOperator.And;
        return `${operator} ${serialized}`;
      })
      .join(' ');
  }

  private serialize(expression: Expression): string {
    switch (expression.type) {
      case ExpressionType.FreeText:
        return expression.value.includes(' ') ? `"${expression.value}"` : expression.value;

      case ExpressionType.Restriction: {
        const { property, operator, value } = expression.restriction;
        const stringValue = String(value);
        const formatted = stringValue.includes(' ') ? `"${stringValue}"` : stringValue;
        return `${property}${operator}${formatted}`;
      }

      case ExpressionType.Range: {
        const { property, from, to } = expression.range;
        return `${property}:${String(from)}..${String(to)}`;
      }

      case ExpressionType.Not:
        return `NOT ${this.serialize(expression.expression)}`;

      case ExpressionType.Group: {
        const inner = expression.expressions
          .map((childExpression, index) => {
            const serialized = this.serialize(childExpression);
            if (index === 0) return serialized;
            const operator = expression.joinOperators[index - 1] ?? BooleanOperator.And;
            return `${operator} ${serialized}`;
          })
          .join(' ');
        return `(${inner})`;
      }
    }
  }
}

// ---- search input ----

export interface SearchInput {
  query: KqlBuilder;
  fields?: SearchField[];
  sortProperties?: { name: SortableField; isDescending: boolean }[];
  entityTypes?: SearchEntityType[];
  from?: number;
  size?: number;
}
