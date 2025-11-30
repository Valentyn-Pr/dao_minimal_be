minimal woring example of BE for blockchaid DAO (pls find by yourseld in my repos)
application does next:
- loads historical events for given DAO address
- keeps recods in sqlite db - so no re-loading from scratch beetween restarts.
- pools for new events when running - every new block.
- exposes APIs with DAO proposals and votes

for local deploy:
- ensure sqlite3 is installed
- db file will be created under DATABASE_URL from .evn
- create .env file in root with next vars
- generate prisma types - yarn prisma generate
- push changes to db - yarn prisma db push

DATABASE_URL="file:./prisma/dev.db" -> path to db file. 
SERVER_PORT=8000 -> webserver port

RPC_URL=https://0xrpc.io/hoodi -> RPC provider url. e.g. Alchemy or Infura

DAO_ADDRESS=0x933c1c4842BE63902Bf50741569c9A880CeaC74a -> deployed DAO contract address

START_BLOCK=1661000 -> should be less by few blocks or equal to block where dao contract was deployed

CHUNK_SIZE=5000 -> how much blocks provider can acquire at once without any issues.
POOLING_INTERVAL=3000 -> how often pool for new blocks. this is not working actyally. need to modify @Interval decorator in pooling.service.ts (known issue. won't fix)
