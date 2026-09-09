import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SharePointContext {
  @IsString()
  @IsNotEmpty()
  siteUrl!: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;
}
