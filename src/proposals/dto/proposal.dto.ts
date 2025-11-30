
import { IsString, IsBoolean, IsInt, IsDate, IsNotEmpty, ValidateNested} from 'class-validator';
import { Type } from 'class-transformer';
import { VotedEventResponseDto } from './voted-event.dto';


export class ProposalResponseDto {
  @IsInt()
  id: number; // matches smart contract proposal ID

  @IsString()
  creator: string;
  
  @IsString()
  description: string;
  
  @IsDate()
  createdAt: Date;
  
  @IsDate()
  executedAt?: Date;

  @IsBoolean()
  executed: boolean

  // store BigInts as sting for easier jsonify
  @IsString()
  voteCountFor: string;

  @IsString()
  voteCountAgainst: string;

  @ValidateNested({ each: true })       // validate each element in the array
  @Type(() => VotedEventResponseDto)    // transform plain objects into DTO instances
  votes: VotedEventResponseDto[];

  constructor(params: {
    id: number;
    creator: string;
    description: string;
    createdAt: Date;
    executedAt?: Date;
    executed: boolean;
    voteCountFor: string;
    voteCountAgainst: string;
    votes: VotedEventResponseDto[];
  }) {
    Object.assign(this, {
      ...params,
      votes: params.votes?.map(v => new VotedEventResponseDto(v)) ?? [],
    });
  }

}
