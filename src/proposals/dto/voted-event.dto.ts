import {IsString, IsBoolean, IsDate } from 'class-validator';

export class VotedEventResponseDto {
  @IsString()
  voter: string;

  @IsBoolean()
  vote: boolean;

  @IsString()
  amount: string;

  @IsDate()
  votedAt: Date;

  constructor(params: {
    voter: string;
    vote: boolean;
    amount: string;
    votedAt: Date;
  }) {
    Object.assign(this, params);
  }

}
