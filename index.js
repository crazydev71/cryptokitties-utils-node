const api = require('etherscan-api').init('YourApiKey');
const bigNum = require("bignumber.js");
const moment = require("moment");
const json2csv = require("json2csv").Parser;
const fs = require('fs');
const debug = require('debug')('debug');

let totalBalance = api;
let contractAddress = '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d';
let outputPath = "";
let fromBlock = 5000000;
let toBlock = 5001000;
let events = [];

const help = () => {
  console.log('node index.js <csvpath to save> [fromBlock=<blockno>] [toBlock=<blockno>]');
  console.log('For example:');
  console.log('   node index.js /home/test/result.csv');
  console.log('   node index.js /home/test/result.csv fromBlock=5000000 toBlock=5001000');
}  

const exit = () => {
  process.exit();
}

const getFilter = () => {
  if (process.argv.length != 3 && process.argv.length != 4 && process.argv.length != 5) {
    help();
    exit();
    return;
  }

  outputPath = process.argv[2];

  for (let i = 3; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("fromBlock=")) {
      fromBlock = Number(arg.substring(8)).toString();
    } else if (arg.startsWith("toBlock=")) {
      toBlock = Number(arg.substring(8)).toString();
    } else {
      console.log('Invalid argument:', arg);
      exit();
      return;
    }
  }

  debug('block filter:', fromBlock, '-', toBlock);
}

const printAllAsJson = (records) => {
  console.log(JSON.stringify(records, null, '  '));
}

const outputAllAsCsv = (records) => {
  const fields = ['kittyId', 'txHash', 'fromAddress', 'toAddress', 'timeStamp'];
  const opts = {fields};

  try {
    const parser = new json2csv(opts);
    const csv = parser.parse(records);
    console.log(csv);
    return csv;
  } catch (error) {
    debug(error);
  }
  return "No record";
}

const saveOutput = (data)=> {
  fs.writeFile(outputPath, data, (error) => {
    if (error)
      debug(error);
  });
}

const main = () => {
  getFilter();

  const getLog = (from, to) => {
    debug('Fetching data from', from, '...');
    const logs = api.log.getLogs(contractAddress, from.toString(), to.toString(), '0x0a5311bd2a6608f08a180df2ee7c5946819a649b204b554bb8e39825b2c50ad5');
    logs.then(async(logData) => {
      debug('Log count: ', logData.result.length, ' from ', from);

      let excludeBlock;
      if (logData.result.length >= 1000) {
        excludeBlock = Number(logData.result[999].blockNumber);
      }
      
      const results = logData.result;
      const step = 5;
      for (let i = 0; i < results.length; i+= step) {
        debug('  ', i, 'of', results.length);
        await Promise.all(
          results.slice(i, i + step).map(log => new Promise((resolve, reject) => {
            if (Number(log.blockNumber) != excludeBlock) {
              const kittyId = log.data.substr(2+64, 64).replace(/^(0)*/, '0x');
              const txHash = log.transactionHash;
              const timeStamp = Number(log.timeStamp);
              const tx = api.proxy.eth_getTransactionByHash(txHash);
              tx.then(txData => {
                const fromAddress = txData.result.from;
                const toAddress = txData.result.to;
                events.push({
                  kittyId: kittyId,
                  txHash: txHash,
                  fromAddress: fromAddress,
                  toAddress: toAddress,
                  timeStamp: timeStamp
                });
                resolve(true);
              }).catch(err => reject(err));
            } else {
              resolve(true);
            }
          }))
        );
      }

      if (excludeBlock) {
        getLog(excludeBlock, to);
      } else {
        debug('Found:', events.length);

        const output = outputAllAsCsv(events);
        saveOutput(output);

        if (events.length > 10)
          debug('Found:', events.length);
      }
    })
    .catch(error => {
      debug(error);
    });
  }

  getLog(fromBlock, toBlock);
}

main();