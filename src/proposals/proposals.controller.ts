import { Controller, Get, HttpException, NotFoundException, Param, ParseIntPipe, UseInterceptors} from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { ProposalResponseDto } from './dto/proposal.dto';
import { VotedEventResponseDto } from './dto/voted-event.dto';


@Controller('proposals')

export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  // async getAllProposals(): Promise<ProposalResponseDto[]> {
  async getAllProposals() {
    const proposals = await this.proposalsService.getAllProposals();
    if (proposals?.length <= 0){
      throw new NotFoundException("there are no propsals");
    }
    
    console.log(proposals); 

    const proposals_dtos = proposals.map((dbProposal) => 
      new ProposalResponseDto({
        id: Number(dbProposal.id),
        creator: dbProposal.creator,
        description: dbProposal.description,
        createdAt: dbProposal.created_at,
        executedAt: dbProposal.executed_at ?? undefined,
        executed: dbProposal.isExecuted,
        voteCountFor: dbProposal.supportedCnt,
        voteCountAgainst: dbProposal.rejectedCnt,

        votes: dbProposal.votes.map(v => new VotedEventResponseDto({
          voter: v.voter,
          vote: v.vote,
          amount: v.amount,
          votedAt: v.votedAt
        }))
      })
    );

    return proposals_dtos;
  }

  @Get(':id')
  async getProposalById(@Param('id', ParseIntPipe) id: number): Promise<ProposalResponseDto> {
    const dbProposal = await this.proposalsService.getProposalById(id);
    if (!dbProposal){
      throw new NotFoundException(`there are no propsal with id ${id}`);
    }
    const proposal_dto =  new ProposalResponseDto({
        id: Number(dbProposal.id.toString()),
        creator: dbProposal.creator,
        description: dbProposal.description,
        createdAt: dbProposal.created_at,
        executedAt: dbProposal.executed_at ?? undefined,
        executed: dbProposal.isExecuted,
        voteCountFor: dbProposal.supportedCnt,
        voteCountAgainst: dbProposal.rejectedCnt,

        votes: dbProposal.votes.map(v => new VotedEventResponseDto({
          voter: v.voter,
          vote: v.vote,
          amount: v.amount,
          votedAt: v.votedAt
        }))
      })
    return proposal_dto;
  }

  @Get(':id/votes')
  async getVotesByProposalId(@Param('id', ParseIntPipe) id: number): Promise<VotedEventResponseDto[]> {
    const dbVotes = await this.proposalsService.getVotesByProposalId(id);

    if (dbVotes.length === 0){
      throw new NotFoundException(`there are no votes for proposal: ${id}`);
    }

    const votesDtos = dbVotes.map(v => new VotedEventResponseDto({
              voter: v.voter,
              vote: v.vote,
              amount: v.amount,
              votedAt: v.votedAt
            }))
  
    return votesDtos;
  }

}
