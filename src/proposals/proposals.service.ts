import { Injectable } from '@nestjs/common';
import { PrismaService } from "src/prisma/prisma.service"
import { Proposal } from '@prisma/client';

@Injectable()
export class ProposalsService {
    constructor(private readonly prismaService: PrismaService){}


    async getAllProposals(){
        return await this.prismaService.client.proposal.findMany({
            include: {votes: true}
        });
    }


    async getProposalById(id: number){
        return await this.prismaService.client.proposal.findFirst({
            where: {id: BigInt(id)},
            include: {votes: true}
        })
    }
    

    async getVotesByProposalId(id){
        return await this.prismaService.client.votedEvent.findMany({
            where: {proposalId: id}
        })
    }


}
