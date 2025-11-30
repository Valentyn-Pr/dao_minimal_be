// polling.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Contract, ethers, JsonRpcProvider } from 'ethers';
import abi from "src/abis/DAO.json";
import { PrismaService } from "src/prisma/prisma.service"


@Injectable()
export class SmartContractEventsPollingService implements OnModuleInit{
  private readonly logger = new Logger(SmartContractEventsPollingService.name);
  private readonly rpcUrl: string;
  private readonly daoAddress: string;
  private readonly provider: JsonRpcProvider;
  private readonly daoContract: Contract;
  private historicalPoolFinished = false;
  private isPooling = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.rpcUrl = this.configService.get<string>('RPC_URL')!;
    if (!this.rpcUrl) throw new Error('RPC_URL is not defined in env');

    this.daoAddress = this.configService.get<string>('DAO_ADDRESS')!;
    if (!this.daoAddress) throw new Error('DAO_ADDRESS is not defined in env');

    this.provider = new JsonRpcProvider(this.rpcUrl);
    this.daoContract = new Contract(this.daoAddress, abi, this.provider);
  }

  // does not work with reading from env var
  // Decorators in TypeScript are evaluated at class definition time, not at runtime.
  // private static readonly poolingInterval = Number(process.env.POOLING_INTERVAL) || 5000;
  // keep hardcoded value here as I do ont want to use setInterval...
  @Interval(5000)
  async poll() {
    if (!this.historicalPoolFinished) return;
    // prevent pooling overlaps when pooling time is bigger then pooling period
    if (this.isPooling) return;
    await this.eventPooling();
  }

  async onModuleInit() {
    // set initial value of start block to db if not already set
    const dbLastProcessedBlock = await this.getLastProcessedBlock();
    const startBlockFromEnv = Number(this.configService.get<number>('START_BLOCK')!);
    if (dbLastProcessedBlock < startBlockFromEnv){
      await this.setLastProcessedBlock(startBlockFromEnv);
    }

    await this.loadHistoricalEvents()
  }

  async loadHistoricalEvents(){
    try{
      const currentBlock = await this.provider.getBlockNumber();
      this.logger.log(`loading historical events untill block ${currentBlock}`)
      const chunkSize = Number(this.configService.get<number>('CHUNK_SIZE')!);

      let fromBlock = await this.getLastProcessedBlock();

      while(fromBlock < currentBlock){
        const chunkStart = fromBlock;
        const chunkEnd = Math.min((fromBlock + chunkSize - 1), currentBlock);

        console.log(`batch from ${chunkStart} to ${chunkEnd}`);
        
        const [proposalCreatedEvents, votedEvents, proposalExecutedEvents] = await Promise.all([
          this.daoContract.queryFilter("ProposalCreated", chunkStart, chunkEnd),
          this.daoContract.queryFilter("Voted", chunkStart, chunkEnd),
          this.daoContract.queryFilter("ProposalExecuted", chunkStart, chunkEnd)
        ])

        if (proposalCreatedEvents.length > 0){
          this.handleProposalCreatedEvents(proposalCreatedEvents);
        }
        if (votedEvents.length > 0){
          this.handleVotedEvents(votedEvents);
        }
        if (proposalExecutedEvents.length > 0){
          this.handleProposalExecutedEvents(proposalExecutedEvents);
        }
        


        fromBlock = chunkEnd + 1;
        // last processed is stored as LAST WE HAVE READ
        await this.setLastProcessedBlock(chunkEnd);
      }
      this.logger.log("Done loading historical events");
      this.historicalPoolFinished = true;

    } catch(error){
      this.logger.error(error);
    }

  }

  async eventPooling(){
    // commented code was used for debugging. you can enable it on demand
    // this.logger.log("starting event pooling");

    const currentBlock = await this.provider.getBlockNumber();
    // add 1 to do not acquire blocks that were processed already
    const fromBlock = await this.getLastProcessedBlock() + 1;

    // when fromBlock === currentBlock -> pool one block
    if (fromBlock > currentBlock){
      // this.logger.log('pooling to early...');
      return
    }
    // this.logger.log("time to pool!");
  
    // block next shedulled poolings until current is running.
    this.isPooling = true;

    this.logger.log(`pooling from block ${fromBlock} to block ${currentBlock}`);

    const [proposalCreatedEvents, votedEvents, proposalExecutedEvents] = await Promise.all([
          this.daoContract.queryFilter("ProposalCreated", fromBlock, currentBlock),
          this.daoContract.queryFilter("Voted", fromBlock, currentBlock),
          this.daoContract.queryFilter("ProposalExecuted", fromBlock, currentBlock)
        ])
  
    if (proposalCreatedEvents.length > 0){
      this.handleProposalCreatedEvents(proposalCreatedEvents);
    }
    if (votedEvents.length > 0){
      this.handleVotedEvents(votedEvents);
    }
    if (proposalExecutedEvents.length > 0){
      this.handleProposalExecutedEvents(proposalExecutedEvents);
    }
    await this.setLastProcessedBlock(currentBlock);
    // remember to unblock future poolings
    this.isPooling = false;
  }

  async handleProposalCreatedEvents(events){
    for (const event of events){
      try{
        
        const [proposalId, creator, description] = event.args;
        const eventTs = await this.getBlockTimestampAsDate(event.blockNumber);

        await this.prismaService.client.proposal.create({
            data: {
                id: proposalId,
                creator: creator,
                description: description,
                isExecuted: false,
                supportedCnt: "0",
                rejectedCnt: "0",
                created_at: eventTs,
            },
        })
        
      } catch(e){
        this.logger.error(e);
      }
    }
  }

  async handleVotedEvents(events){
    for (const event of events){
      try{
        
        const [proposalId, voter, vote, amount] = event.args;
        const eventTs = await this.getBlockTimestampAsDate(event.blockNumber);
        
        await this.prismaService.client.votedEvent.create({
          data: {
            proposalId: proposalId,
            voter: voter,
            vote: vote,
            amount: amount.toString(),
            votedAt: eventTs
          }
        })
        
        // udpate proposal to keep all data in db without redundant block-chain query
        const proposal = await this.prismaService.client.proposal.findUnique({
          where: { id: proposalId },
        });

        if (!proposal) {
          this.logger.error(`Proposal ${proposalId} not found`);
          continue;
        }

        // Update counters as strings representing bigint
        const newSupported = vote
          ? (BigInt(proposal.supportedCnt) + amount).toString()
          : proposal.supportedCnt;

        const newRejected = !vote
          ? (BigInt(proposal.rejectedCnt) + amount).toString()
          : proposal.rejectedCnt;
        
        await this.prismaService.client.proposal.update({
        where: { id: proposalId },
        data: {
          supportedCnt: newSupported,
          rejectedCnt: newRejected,
        }

      });

      } catch(e){
        this.logger.error(e);
      }
    }
  }

  async handleProposalExecutedEvents(events){
    for (const event of events){
      try{
        const [proposalId, executor, rewarded] = event.args;
        const eventTs = await this.getBlockTimestampAsDate(event.blockNumber);
        await this.prismaService.client.proposalExecutedEvent.create({
          data:{
            proposalId: proposalId,
            executor: executor,
            rewarded: rewarded,
            executedAt: eventTs,
          }
        })

        await this.prismaService.client.proposal.update({
          where: { id: proposalId},
          data: {
            isExecuted: true,
            executed_at: eventTs
          }
        })

      } catch(e){
        this.logger.error(e);
      }
    }
  }

  async getBlockTimestampAsDate(blockNumber: number){
    const block = await this.provider.getBlock(blockNumber);
    // Ethereum block timestamps are UNIX timestamps in seconds, 
    // while JavaScript Date expects milliseconds.
    return new Date(block!.timestamp * 1000);
  }

  // Get lastProcessedBlock
  async getLastProcessedBlock(): Promise<number> {
    const settings = await this.prismaService.client.appSettings.findUnique({
      where: { id: 1 },
    });
    // to avoid complex init logic just return 1. 
    // onModuleInit we set start block from env to db 
    // but it can be moved to different service eventually 
    return settings?.lastProcessedBlock ?? 1;
  }

  // Set lastProcessedBlock
  async setLastProcessedBlock(value: number) {
    return this.prismaService.client.appSettings.upsert({
      where: { id: 1 },
      update: { lastProcessedBlock: value },
      create: { id: 1, lastProcessedBlock: value },
    });
  }

}
