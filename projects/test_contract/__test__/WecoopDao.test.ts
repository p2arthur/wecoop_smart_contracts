import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { WecoopDaoClient } from '../contracts/clients/WecoopDaoClient';
import algosdk, { Algodv2 } from 'algosdk';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

//------------------------------------------------------------------------------------------------------------
let appClient: WecoopDaoClient;
let algorandClient: algokit.AlgorandClient;
let appAddress: string;
let algodClient: Algodv2;
//------------------------------------------------------------------------------------------------------------

//------------------------------------------------------------------------------------------------------------
const daoQuestion1 = 'Is this the first ever question on wecoop.xyz polls?';
const daoQuestion2 = 'Are there two different polls on this wecoop contract?';
//------------------------------------------------------------------------------------------------------------

describe('WecoopDao', () => {
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

    //Create the mbr transaction for creating the poll box
    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
    });

    //Create the asset funding transaction
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: assetCreator.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 1,
      assetIndex: Number(daoAsset),
    });

    //Send transactions to the createPoll contract call and create the poll box
    const result = await appClient.createPoll({
      mbrTxn,
      axfer: axfer,
      question: daoQuestion1,
    });

    console.log('Create poll result: Poll created successfully');
  });
  //------------------------------------------------------------------------------------------------------------

  test('Positive - User should create a poll and return the created poll box', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    //Create the mbr transaction for creating the poll box
    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
    });

    //Create the asset funding transaction
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: assetCreator.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 1,
      assetIndex: Number(daoAsset),
    });

    //Send transactions to the createPoll contract call and create the poll box
    const result = await appClient.createPoll({
      mbrTxn,
      axfer: axfer,
      question: daoQuestion2,
    });

    console.log('Create poll result: Poll created successfully');
  });
  //------------------------------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test('Positive - Should return the poll with the id 0', async () => {
    const result = await appClient.getPollById({ pollId: [0] });

    console.log('Poll 1 data:', result.return);
  });
  //------------------------------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test('Positive - Should return the poll with the id 1', async () => {
    const result = await appClient.getPollById({ pollId: [1] });

    console.log('Poll 2 data:', result.return);
  });
  //------------------------------------------------------------------------------------------------------------
});
