import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The SharePoint context that can be used to help answer.
 */
export class PageContext {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  siteUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  pageUrl?: string;
}
