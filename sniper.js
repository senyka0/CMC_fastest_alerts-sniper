const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events/index.js");
const fetch = require("node-fetch");
const ethers = require("ethers");
const input = require("input");
let sum;
let signer;
let timeDelay;
const busdAdr = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    const privateKey = await input.text("Please enter your private key from metamask: ");
    signer = new ethers.Wallet(privateKey, provider);
    sum = parseInt(await input.text("Please enter your trade amount of BUSD for each trade (without decimals): "));
    timeDelay = parseInt(await input.text("Please enter time delay between buy and sell (in seconds): "));
    const apiId = parseInt(await input.text("Please enter your apiId: "));
    const apiHash = await input.text("Please enter your apiHash: ");
    const stringSession = new StringSession(await input.text("Please enter your stringSession (if you have, otherwise just press Enter, and after save your new session from logs): "));
    const client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.start({
      phoneNumber: async () => await input.text("Please enter your number: "),
      password: async () => await input.text("Please enter your password: "),
      phoneCode: async () =>
        await input.text("Please enter the code you received: "),
      onError: (err) => console.log(err),
    });
    console.log("You should now be connected.");
    console.log("Save this session to avoid logging in again: ");
    console.log(client.session.save());
    await client.addEventHandler(onNewMessage, new NewMessage({}));
})();

async function onNewMessage(event) {
    let message = event.message.message;
    let rows = message.split("\n");
    if (rows[0].split(" ")[0]=="🔴"  && parseInt(rows[7].split("%")[0])<=5 && parseInt(rows[8].split("%")[0])<=5 && ((rows[4].split(" ").slice(-1)[0]=="BUSD" && parseFloat(rows[4].split(" ").slice(-2)[0])>50000) || (rows[4].split(" ").slice(-1)[0]=="USDT" && parseFloat(rows[4].split(" ").slice(-2)[0])>50000) || (rows[4].split(" ").slice(-1)[0]=="BNB" && parseFloat(rows[4].split(" ").slice(-2)[0])>100))) {
        let address = rows[3].split(":")[1].replace(/ /g,"");
        await trade(address);
    }
}
async function trade(address) {
    let result1 = await fetch(`https://api.1inch.exchange/v4.0/56/swap?fromTokenAddress=${busdAdr}&toTokenAddress=${address}&amount=${sum*Math.pow(10, 18)}&fromAddress=${signer.address}&slippage=20`).then(result => {if(result.status == 200){return result.json()}});
    let tx1 = result1.tx;
    tx1.gasPrice = parseInt(tx1.gasPrice)+5000000000;
    tx1.gasLimit =  parseInt(tx1.gas);
    tx1.value = parseInt(tx1.value);
    delete tx1.gas;
    console.log(`swap ${result1.fromToken.symbol} => ${result1.toToken.symbol}`);
    let buy = await signer.sendTransaction(tx1);
    await buy.wait();
    await sleep(timeDelay*1000);
    let balance = await fetch(`https://api.bscscan.com/api?module=account&action=tokenbalance&contractaddress=${address}&address=${signer.address}&tag=latest&apikey=IWPP5MJZX5XFQZKYE9CJ5IDEQAGX372AJZ`).then(result => {if(result.status == 200){return result.json()}});
    let result2 = await fetch(`https://api.1inch.exchange/v4.0/56/approve/transaction?tokenAddress=${address}&amount=${balance.result}`).then(result => {if(result.status == 200){return result.json()}});
    let tx2 = result2;
    tx2.gasPrice = parseInt(tx2.gasPrice);
    tx2.value = parseInt(tx2.value);
    console.log(`approve ${result1.toToken.symbol}`);
    let approve = await signer.sendTransaction(tx2);
    await approve.wait();
    let result3 = await fetch(`https://api.1inch.exchange/v4.0/56/swap?fromTokenAddress=${address}&toTokenAddress=${busdAdr}&amount=${balance.result}&fromAddress=${signer.address}&slippage=5`).then(result => {if(result.status == 200){return result.json()}});
    let tx3 = result3.tx;
    tx3.gasPrice = parseInt(tx3.gasPrice);
    tx3.gasLimit =  parseInt(tx3.gas);
    tx3.value = parseInt(tx3.value);
    delete tx3.gas;
    console.log(`swap ${result3.fromToken.symbol} => ${result3.toToken.symbol}`);
    let sell = await signer.sendTransaction(tx3);
    await sell.wait();
    console.log(`profit: ${(result3.toTokenAmount/Math.pow(10, 18)-sum)/sum*100} %`);
}