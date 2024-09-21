import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { WecoopDaoClient } from '../contracts/clients/WecoopDaoClient';
import algosdk, { Algodv2 } from 'algosdk';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

//------------------------------------------------------------------------------------------------------------
let appClient: WecoopDaoClient;

let appAddress: string;

//------------------------------------------------------------------------------------------------------------

//------------------------------------------------------------------------------------------------------------
const daoQuestion1 = 'Is this the first ever question on wecoop.xyz polls?';
const daoQuestion2 = 'Are there two different polls on this wecoop contract?';
//------------------------------------------------------------------------------------------------------------

describe('WecoopDao', () => {
  let algorandClient: algokit.AlgorandClient;
  let algodClient: Algodv2;
  beforeEach(fixture.beforeEach);
  let assetCreator: algosdk.Account;
  let daoAsset: bigint;

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    assetCreator = testAccount;

    const { algorand } = fixture;

    algorandClient = algorand;

    const createdAsset = (await algorand.send.assetCreate({ sender: assetCreator.addr, total: BigInt(10_000) }))
      .confirmation.assetIndex;

    daoAsset = BigInt(createdAsset!);
    algodClient = algorand.client.algod;

    appClient = new WecoopDaoClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algorand.client.algod
    );

    await appClient.create.createApplication({});
  });
  //------------------------------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test('Positive - Contract should optin to the provided asset', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    //Create mbr transaction to opt contract to the poll asset
    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.algos(0.1 + 0.1),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    //Send the mbr transaction + deposit to the contract address
    const result = appClient.optinToAsset({ mbrTxn, asset: daoAsset });

    console.log('result!&@#!2321', (await result).return);
  });
  //------------------------------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test('Positive - User should create a poll and return the created poll box', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    // Create the MBR transaction for creating the poll box
    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
    });

    // Create the asset funding transaction (axfer)
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: assetCreator.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 2,
      assetIndex: Number(daoAsset),
    });

    // Send transactions to the createPoll contract call (this sends axfer internally)
    const result = await appClient.createPoll(
      {
        mbrTxn,
        axfer: axfer, // The asset transfer happens here, so you don't need to send it again
        question: daoQuestion1,
      },
      {
        sender: assetCreator,
        sendParams: {
          fee: algokit.microAlgos(3_000),
        },
      }
    );

    console.log('Create poll result: Poll created successfully');

    // Check the app's account to confirm the asset was transferred
    try {
      const appAccountAfter = await algodClient.accountInformation(appAddress).do();

      console.log('appAccountAfter', appAccountAfter);

      const assetHoldingAfter = appAccountAfter.assets.find((asset: any) => asset['asset-id'] == daoAsset);
      const balanceAfter = assetHoldingAfter ? assetHoldingAfter.amount : 0;

      console.log('Balance after', balanceAfter);

      // Assert that the balance has increased by the deposited amount
      expect(balanceAfter).toBe(2);
    } catch (error) {
      console.error('Error fetching asset balance:', error);
    }
  });

  //------------------------------------------------------------------------------------------------------------
  test('Positive - Should return the poll with the id 0', async () => {
    const result = await appClient.getPollByPollId({ pollId: [1] });

    console.log('Poll 1 data:', result.return);
  });
  //------------------------------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test('Positive - User makes a vote', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    // Create the MBR transaction for creating the poll box
    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
    });

    // Create the asset funding transaction (axfer)
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: assetCreator.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 2,
      assetIndex: Number(daoAsset),
    });

    const result = await appClient.makeVote({ pollId: [1], axfer, mbrTxn, inFavor: true });
    const appAccountAfter = await algodClient.accountInformation(appAddress).do();

    console.log('appAccountAfter', appAccountAfter);

    const assetHoldingAfter = appAccountAfter.assets.find((asset: any) => asset['asset-id'] == daoAsset);
    const balanceAfter = assetHoldingAfter ? assetHoldingAfter.amount : 0;

    console.log('Balance after', balanceAfter);
  });

  test('Positive - Get vote with nonce 1 on poll with nonce 1', async () => {
    const result = await appClient.getVoteByVoteId({ voteId: [1, [1]] });
    console.log('vote result', result.return);
  });

  test('Positive - Get poll with nonce 1 - check if theres one vote on the counter', async () => {
    const result = await appClient.getPollByPollId({ pollId: [1] });
    console.log('Poll after vote', result.return);
  });
});
