import { DateInterval, KqlBuilder, Operator } from './KqlBuilder';

describe('KqlBuilder', () => {
  // ──────────────────────────────────────────────
  // Single restriction
  // ──────────────────────────────────────────────

  describe('single property restriction', () => {
    it('should build a text contains restriction', () => {
      const result = new KqlBuilder()
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .build();

      expect(result).toBe('contentClass:STS_ListItem_WebPageLibrary');
    });

    it('should build a text equals restriction', () => {
      const result = new KqlBuilder().where('title', Operator.Equals, 'Quarterly Report').build();

      expect(result).toBe('title="Quarterly Report"');
    });

    it('should build a YesNo contains restriction', () => {
      const result = new KqlBuilder().where('isDocument', Operator.Contains, 1).build();

      expect(result).toBe('isDocument:1');
    });

    it('should build a YesNo equals restriction with falsy value', () => {
      const result = new KqlBuilder().where('isDocument', Operator.Equals, 0).build();

      expect(result).toBe('isDocument=0');
    });

    it('should build an integer greater-than restriction', () => {
      const result = new KqlBuilder().where('promotedState', Operator.GreaterThan, 0).build();

      expect(result).toBe('promotedState>0');
    });

    it('should build an integer less-than-or-equal restriction', () => {
      const result = new KqlBuilder().where('promotedState', Operator.LessThanOrEqual, 2).build();

      expect(result).toBe('promotedState<=2');
    });

    it('should build an integer not-equal restriction', () => {
      const result = new KqlBuilder().where('promotedState', Operator.NotEqual, 0).build();

      expect(result).toBe('promotedState<>0');
    });

    it('should build a datetime contains restriction with ISO date', () => {
      const result = new KqlBuilder()
        .where('modifiedOWSDATE', Operator.Contains, '2024-01-15')
        .build();

      expect(result).toBe('modifiedOWSDATE:2024-01-15');
    });

    it('should build a datetime greater-than restriction', () => {
      const result = new KqlBuilder()
        .where('modifiedOWSDATE', Operator.GreaterThan, '2024-01-01')
        .build();

      expect(result).toBe('modifiedOWSDATE>2024-01-01');
    });
  });

  // ──────────────────────────────────────────────
  // Range restrictions
  // ──────────────────────────────────────────────

  describe('whereRange', () => {
    it('should build a datetime range restriction', () => {
      const result = new KqlBuilder()
        .whereRange('modifiedOWSDATE', '2024-01-01', '2024-12-31')
        .build();

      expect(result).toBe('modifiedOWSDATE:2024-01-01..2024-12-31');
    });

    it('should build an integer range restriction', () => {
      const result = new KqlBuilder().whereRange('promotedState', 0, 2).build();

      expect(result).toBe('promotedState:0..2');
    });

    it('should combine range with other restrictions using implicit AND', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .whereRange('modifiedOWSDATE', '2024-01-01', '2024-06-30')
        .build();

      expect(result).toBe('isDocument:1 AND modifiedOWSDATE:2024-01-01..2024-06-30');
    });

    it('should support range inside a group', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .group((subBuilder) =>
          subBuilder
            .whereRange('modifiedOWSDATE', '2024-01-01', '2024-06-30')
            .or()
            .whereRange('modifiedOWSDATE', '2023-01-01', '2023-06-30'),
        )
        .build();

      expect(result).toBe(
        'isDocument:1 AND (modifiedOWSDATE:2024-01-01..2024-06-30 OR modifiedOWSDATE:2023-01-01..2023-06-30)',
      );
    });

    it('should return the builder instance for chaining', () => {
      const builder = new KqlBuilder();
      expect(builder.whereRange('modifiedOWSDATE', '2024-01-01', '2024-12-31')).toBe(builder);
    });
  });

  // ──────────────────────────────────────────────
  // Date interval keywords
  // ──────────────────────────────────────────────

  describe('date interval keywords', () => {
    it('should not quote single-word date intervals', () => {
      const result = new KqlBuilder()
        .where('modifiedOWSDATE', Operator.Contains, DateInterval.Today)
        .build();

      expect(result).toBe('modifiedOWSDATE:today');
    });

    it('should quote multi-word date intervals', () => {
      const result = new KqlBuilder()
        .where('modifiedOWSDATE', Operator.Contains, DateInterval.ThisWeek)
        .build();

      expect(result).toBe('modifiedOWSDATE:"this week"');
    });

    it("should quote 'last month' date interval", () => {
      const result = new KqlBuilder()
        .where('modifiedOWSDATE', Operator.Equals, DateInterval.LastMonth)
        .build();

      expect(result).toBe('modifiedOWSDATE="last month"');
    });

    it("should quote 'this year' date interval", () => {
      const result = new KqlBuilder()
        .where('createdOWSDATE', Operator.Contains, DateInterval.ThisYear)
        .build();

      expect(result).toBe('createdOWSDATE:"this year"');
    });

    it("should quote 'last year' date interval", () => {
      const result = new KqlBuilder()
        .where('createdOWSDATE', Operator.Contains, DateInterval.LastYear)
        .build();

      expect(result).toBe('createdOWSDATE:"last year"');
    });
  });

  // ──────────────────────────────────────────────
  // Value quoting
  // ──────────────────────────────────────────────

  describe('value quoting', () => {
    it('should not quote single-word text values', () => {
      const result = new KqlBuilder().where('fileExtension', Operator.Contains, 'docx').build();

      expect(result).toBe('fileExtension:docx');
    });

    it('should quote text values containing spaces', () => {
      const result = new KqlBuilder()
        .where('authorOWSUSER', Operator.Contains, 'John Smith')
        .build();

      expect(result).toBe('authorOWSUSER:"John Smith"');
    });

    it('should not quote numeric values', () => {
      const result = new KqlBuilder().where('promotedState', Operator.Equals, 2).build();

      expect(result).toBe('promotedState=2');
    });

    it('should quote URL paths containing spaces', () => {
      const result = new KqlBuilder()
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/My Site')
        .build();

      expect(result).toBe('path:"https://contoso.sharepoint.com/sites/My Site"');
    });

    it('should not quote URL paths without spaces', () => {
      const result = new KqlBuilder()
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/intranet')
        .build();

      expect(result).toBe('path:https://contoso.sharepoint.com/sites/intranet');
    });
  });

  // ──────────────────────────────────────────────
  // Free text
  // ──────────────────────────────────────────────

  describe('freetext', () => {
    it('should output a single word without quotes', () => {
      const result = new KqlBuilder().freetext('budget').build();

      expect(result).toBe('budget');
    });

    it('should quote a multi-word phrase', () => {
      const result = new KqlBuilder().freetext('quarterly budget review').build();

      expect(result).toBe('"quarterly budget review"');
    });

    it('should combine freetext with restrictions using implicit AND', () => {
      const result = new KqlBuilder()
        .freetext('budget')
        .where('fileExtension', Operator.Contains, 'docx')
        .build();

      expect(result).toBe('budget AND fileExtension:docx');
    });
  });

  // ──────────────────────────────────────────────
  // NOT restrictions
  // ──────────────────────────────────────────────

  describe('not', () => {
    it('should negate a single restriction', () => {
      const result = new KqlBuilder().not('fileExtension', Operator.Contains, 'aspx').build();

      expect(result).toBe('NOT fileExtension:aspx');
    });

    it('should combine NOT with a preceding restriction using implicit AND', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .not('fileExtension', Operator.Contains, 'aspx')
        .build();

      expect(result).toBe('isDocument:1 AND NOT fileExtension:aspx');
    });

    it('should combine NOT with OR when explicitly set', () => {
      const result = new KqlBuilder()
        .where('fileExtension', Operator.Contains, 'docx')
        .or()
        .not('fileExtension', Operator.Contains, 'aspx')
        .build();

      expect(result).toBe('fileExtension:docx OR NOT fileExtension:aspx');
    });
  });

  // ──────────────────────────────────────────────
  // Implicit AND between restrictions
  // ──────────────────────────────────────────────

  describe('implicit AND', () => {
    it('should join two restrictions with AND by default', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .build();

      expect(result).toBe('isDocument:1 AND contentClass:STS_ListItem_WebPageLibrary');
    });

    it('should join three restrictions with AND by default', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com')
        .build();

      expect(result).toBe(
        'isDocument:1 AND contentClass:STS_ListItem_WebPageLibrary AND path:https://contoso.sharepoint.com',
      );
    });
  });

  // ──────────────────────────────────────────────
  // Explicit boolean operators
  // ──────────────────────────────────────────────

  describe('explicit boolean operators', () => {
    it('should join restrictions with explicit AND', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .and()
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .build();

      expect(result).toBe('isDocument:1 AND contentClass:STS_ListItem_WebPageLibrary');
    });

    it('should join restrictions with OR', () => {
      const result = new KqlBuilder()
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .or()
        .where('contentClass', Operator.Contains, 'STS_ListItem_DocumentLibrary')
        .build();

      expect(result).toBe(
        'contentClass:STS_ListItem_WebPageLibrary OR contentClass:STS_ListItem_DocumentLibrary',
      );
    });

    it('should support mixed AND and OR operators', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .and()
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .or()
        .where('contentClass', Operator.Contains, 'STS_ListItem_DocumentLibrary')
        .build();

      expect(result).toBe(
        'isDocument:1 AND contentClass:STS_ListItem_WebPageLibrary OR contentClass:STS_ListItem_DocumentLibrary',
      );
    });
  });

  // ──────────────────────────────────────────────
  // Grouped expressions
  // ──────────────────────────────────────────────

  describe('group', () => {
    it('should wrap grouped expressions in parentheses', () => {
      const result = new KqlBuilder()
        .group((subBuilder) =>
          subBuilder
            .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
            .or()
            .where('contentClass', Operator.Contains, 'STS_ListItem_DocumentLibrary'),
        )
        .build();

      expect(result).toBe(
        '(contentClass:STS_ListItem_WebPageLibrary OR contentClass:STS_ListItem_DocumentLibrary)',
      );
    });

    it('should join a group with a preceding restriction using implicit AND', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .group((subBuilder) =>
          subBuilder
            .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
            .or()
            .where('contentClass', Operator.Contains, 'STS_ListItem_DocumentLibrary'),
        )
        .build();

      expect(result).toBe(
        'isDocument:1 AND (contentClass:STS_ListItem_WebPageLibrary OR contentClass:STS_ListItem_DocumentLibrary)',
      );
    });

    it('should join a group with OR when explicitly set', () => {
      const result = new KqlBuilder()
        .where('fileExtension', Operator.Contains, 'docx')
        .or()
        .group((subBuilder) =>
          subBuilder
            .where('fileExtension', Operator.Contains, 'pptx')
            .or()
            .where('fileExtension', Operator.Contains, 'xlsx'),
        )
        .build();

      expect(result).toBe('fileExtension:docx OR (fileExtension:pptx OR fileExtension:xlsx)');
    });

    it('should support implicit AND within a group', () => {
      const result = new KqlBuilder()
        .group((subBuilder) =>
          subBuilder
            .where('isDocument', Operator.Contains, 1)
            .where('fileExtension', Operator.Contains, 'aspx'),
        )
        .build();

      expect(result).toBe('(isDocument:1 AND fileExtension:aspx)');
    });

    it('should support nested groups', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .group((subBuilder) =>
          subBuilder
            .where('fileExtension', Operator.Contains, 'aspx')
            .or()
            .group((innerBuilder) =>
              innerBuilder
                .where('fileExtension', Operator.Contains, 'docx')
                .where('authorOWSUSER', Operator.Contains, 'John'),
            ),
        )
        .build();

      expect(result).toBe(
        'isDocument:1 AND (fileExtension:aspx OR (fileExtension:docx AND authorOWSUSER:John))',
      );
    });
  });

  // ──────────────────────────────────────────────
  // and() / or() edge cases
  // ──────────────────────────────────────────────

  describe('and/or edge cases', () => {
    it('should not throw when and() is called on an empty builder', () => {
      expect(() => new KqlBuilder().and()).not.toThrow();
    });

    it('should not throw when or() is called on an empty builder', () => {
      expect(() => new KqlBuilder().or()).not.toThrow();
    });

    it('should use the last-set operator when and/or are called multiple times', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .and()
        .or()
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .build();

      expect(result).toBe('isDocument:1 OR contentClass:STS_ListItem_WebPageLibrary');
    });
  });

  // ──────────────────────────────────────────────
  // Empty builder
  // ──────────────────────────────────────────────

  describe('empty builder', () => {
    it('should return an empty string when no expressions are added', () => {
      const result = new KqlBuilder().build();
      expect(result).toBe('');
    });
  });

  // ──────────────────────────────────────────────
  // Chaining / fluent API
  // ──────────────────────────────────────────────

  describe('fluent chaining', () => {
    it('should return the builder instance from where()', () => {
      const builder = new KqlBuilder();
      expect(builder.where('isDocument', Operator.Contains, 1)).toBe(builder);
    });

    it('should return the builder instance from freetext()', () => {
      const builder = new KqlBuilder();
      expect(builder.freetext('test')).toBe(builder);
    });

    it('should return the builder instance from not()', () => {
      const builder = new KqlBuilder();
      expect(builder.not('isDocument', Operator.Contains, 1)).toBe(builder);
    });

    it('should return the builder instance from group()', () => {
      const builder = new KqlBuilder();
      expect(builder.group((sub) => sub)).toBe(builder);
    });

    it('should return the builder instance from and()', () => {
      const builder = new KqlBuilder();
      expect(builder.and()).toBe(builder);
    });

    it('should return the builder instance from or()', () => {
      const builder = new KqlBuilder();
      expect(builder.or()).toBe(builder);
    });
  });

  // ──────────────────────────────────────────────
  // Realistic query scenarios
  // ──────────────────────────────────────────────

  describe('realistic query scenarios', () => {
    it('should build a typical site pages query', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/intranet')
        .build();

      expect(result).toBe(
        'isDocument:1 AND contentClass:STS_ListItem_WebPageLibrary AND path:https://contoso.sharepoint.com/sites/intranet',
      );
    });

    it('should build a query for promoted pages modified this month', () => {
      const result = new KqlBuilder()
        .where('promotedState', Operator.Equals, 2)
        .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
        .where('modifiedOWSDATE', Operator.Contains, DateInterval.ThisMonth)
        .build();

      expect(result).toBe(
        'promotedState=2 AND contentClass:STS_ListItem_WebPageLibrary AND modifiedOWSDATE:"this month"',
      );
    });

    it('should build a query for multiple content classes excluding aspx', () => {
      const result = new KqlBuilder()
        .where('isDocument', Operator.Contains, 1)
        .group((subBuilder) =>
          subBuilder
            .where('contentClass', Operator.Contains, 'STS_ListItem_WebPageLibrary')
            .or()
            .where('contentClass', Operator.Contains, 'STS_ListItem_DocumentLibrary'),
        )
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/intranet')
        .not('fileExtension', Operator.Contains, 'aspx')
        .build();

      expect(result).toBe(
        'isDocument:1 AND (contentClass:STS_ListItem_WebPageLibrary OR contentClass:STS_ListItem_DocumentLibrary) AND path:https://contoso.sharepoint.com/sites/intranet AND NOT fileExtension:aspx',
      );
    });

    it('should build a query for a specific file by exact path', () => {
      const result = new KqlBuilder()
        .where(
          'path',
          Operator.Contains,
          'https://contoso.sharepoint.com/sites/intranet/SitePages/welcome.aspx',
        )
        .build();

      expect(result).toBe(
        'path:https://contoso.sharepoint.com/sites/intranet/SitePages/welcome.aspx',
      );
    });

    it('should build a freetext query scoped to a site with date range', () => {
      const result = new KqlBuilder()
        .freetext('annual review')
        .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/hr')
        .whereRange('modifiedOWSDATE', '2024-01-01', '2024-12-31')
        .build();

      expect(result).toBe(
        '"annual review" AND path:https://contoso.sharepoint.com/sites/hr AND modifiedOWSDATE:2024-01-01..2024-12-31',
      );
    });

    it('should build a query filtering by author within multiple sites', () => {
      const result = new KqlBuilder()
        .where('authorOWSUSER', Operator.Contains, 'Jane Doe')
        .where('isDocument', Operator.Contains, 1)
        .group((subBuilder) =>
          subBuilder
            .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/engineering')
            .or()
            .where('path', Operator.Contains, 'https://contoso.sharepoint.com/sites/design'),
        )
        .build();

      expect(result).toBe(
        'authorOWSUSER:"Jane Doe" AND isDocument:1 AND (path:https://contoso.sharepoint.com/sites/engineering OR path:https://contoso.sharepoint.com/sites/design)',
      );
    });
  });
});
