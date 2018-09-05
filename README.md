# cryptokitties-utils
Get birth events for cryptokitties contract within block range.

## Build
npm install

## Usage
node index.js `csvpath to save to` [fromBlock=`blockno`] [toBlock=`blockno`]
  
For example:

node index.js /home/test/result.csv

node index.js /home/test/result.csv fromBlock=5000000 toBlock=5001000

