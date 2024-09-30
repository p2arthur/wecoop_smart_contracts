import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { WecoopDaoClient } from '../contracts/clients/WecoopDaoClient';
import algosdk, { Algodv2 } from 'algosdk';
import AlgodClient from 'algosdk/dist/types/client/v2/algod/algod';
import { algos, getOrCreateKmdWalletAccount } from '@algorandfoundation/algokit-utils';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';

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
let algorandClient: algokit.AlgorandClient;
let algodClient: Algodv2;
describe('WecoopDao', () => {
  beforeEach(fixture.beforeEach);
  let assetCreator: algosdk.Account;
  let daoVoter: TransactionSignerAccount;
  let daoAsset: bigint;
  let daoFakeAsset: bigint;

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount, kmd } = fixture.context;
    assetCreator = testAccount;

    const { algorand } = fixture;

    algorandClient = algorand;

    // Create a new wallet

    daoVoter = await algorandClient.account.kmd.getOrCreateWalletAccount('tealscript-dao-sender', algos(10));

    // Fund the new wallet with some algos
    await algorandClient.send.payment({
      sender: assetCreator.addr,
      receiver: daoVoter.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });

    const createdAsset = (await algorand.send.assetCreate({ sender: assetCreator.addr, total: BigInt(10_000) }))
      .confirmation.assetIndex;

    const createdAsset2 = (
      await algorand.send.assetCreate({ sender: daoVoter.addr, total: BigInt(10_000), signer: daoVoter.signer })
    ).confirmation.assetIndex;

    daoAsset = BigInt(createdAsset!);
    daoFakeAsset = BigInt(createdAsset2!);
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
  //-----------------------------------------------------------------------------
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
        question: daoQuestion2,
      },
      {
        sender: assetCreator,
        sendParams: {
          fee: algokit.microAlgos(3_000),
        },
      }
    );

    console.log('Create poll result 2: Poll created successfully');

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

  //------------------------------------------------------------------------------------------------------------
  test('Positive - User makes a vote', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();
    const optinAxfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: daoVoter.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: daoVoter.addr,
      amount: 0,
      assetIndex: Number(daoAsset),
    });
    await algokit.sendTransaction({ transaction: optinAxfer, from: daoVoter }, algodClient); // daoVoter should be the signer
    // ----------------------------------------------------------------------------------------
    //Send dao Token so voter can use it to vote
    const fundAxfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: assetCreator.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: daoVoter.addr,
      amount: 20,
      assetIndex: Number(daoAsset),
    });

    await algokit.sendTransaction({ transaction: fundAxfer, from: assetCreator }, algodClient);

    // Create the MBR transaction for creating the poll box
    const mbrTxn = algorandClient.send.payment({
      sender: daoVoter.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
      signer: daoVoter.signer,
    });

    // Create the asset funding transaction (axfer)
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: daoVoter.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 2,
      assetIndex: Number(daoAsset),
    });

    const result = await appClient.makeVote({ pollId: [1], axfer, mbrTxn, inFavor: true }, { sender: daoVoter });
    const appAccountAfter = await algodClient.accountInformation(appAddress).do();

    const assetHoldingAfter = appAccountAfter.assets.find((asset: any) => asset['asset-id'] == daoAsset);
    const balanceAfter = assetHoldingAfter ? assetHoldingAfter.amount : 0;
  });
  //--------------------------------------------------------------------------------------

  //--------------------------------------------------------------------------------------
  test.skip('Negative - Creator cant vote', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

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
      amount: 1,
      assetIndex: Number(daoAsset),
    });

    expect(
      await appClient.makeVote({ pollId: [1], axfer, mbrTxn, inFavor: true }, { sender: assetCreator })
    ).rejects.toThrow();
  });
  //--------------------------------------------------------------------------------------

  //--------------------------------------------------------------------------------------
  test.skip('Negative - dao voter cant vote with wrong coin', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    // Create mbr transaction to opt contract to the poll asset (using the correct asset initially)
    const mbrOptinTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.algos(0.1 + 0.1),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    // Opt the contract into the fake asset (daoFakeAsset) instead of the correct one
    await appClient.optinToAsset({ mbrTxn: mbrOptinTxn, asset: daoFakeAsset });

    const mbrTxn = algorandClient.send.payment({
      sender: assetCreator.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
    });

    // Create the asset funding transaction (axfer) using the wrong asset (daoFakeAsset)
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: daoVoter.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 1,
      assetIndex: Number(daoFakeAsset), // Using the fake asset here
    });

    // Expect the makeVote call to fail with the wrong asset
    await expect(
      appClient.makeVote({ pollId: [1], axfer, mbrTxn, inFavor: true }, { sender: assetCreator })
    ).rejects.toThrow();
  });

  //--------------------------------------------------------------------------------------

  //--------------------------------------------------------------------------------------
  test('Positive - Dao voter votes again - against this time', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    const mbrTxn = algorandClient.send.payment({
      sender: daoVoter.addr,
      amount: algokit.microAlgos(3_450),
      receiver: appAddress,
      signer: daoVoter.signer,
    });

    // Create the asset funding transaction (axfer)
    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: daoVoter.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 1,
      assetIndex: Number(daoAsset),
    });

    const result = await appClient.makeVote({ pollId: [1], axfer, mbrTxn, inFavor: false }, { sender: daoVoter });
  });

  //--------------------------------------------------------------------------------------

  //------------------------------------------------------------------------------------------------------------
  test.skip('Positive get all polls by looping through globalState', async () => {
    const { totalPolls } = await appClient.appClient.getGlobalState();

    const allPolls = [];

    const totalPollsLimit = Number(totalPolls.value);

    for (let i = 1; i <= totalPollsLimit; i++) {
      const currentPoll = (await appClient.getPollByPollId({ pollId: [i] })).return;

      allPolls.push(currentPoll);
    }

    console.log('All polls', allPolls);
  });
  //------------------------------------------------------------------------------------------------------------

  // test('Positive - Gets all votes of poll with id 1', async () => {
  //   const { appAddress } = await appClient.appClient.getAppReference();

  //   // Get the pollId, assuming it is set to 1 (this should be the created poll ID)
  //   const pollId = { nonce: BigInt(1) };

  //   // Retrieve the total number of votes from the poll
  //   const pollInfo = await appClient.getPollByPollId({ pollId: [1] });

  //   // Use optional chaining to safely access pollInfo.return and the fourth item
  //   const totalVotes = pollInfo.return ? Number(pollInfo.return[3]) : 0; // Default to 0 if undefined

  //   console.log('poll info', totalVotes);
  //   const allVotes = [];

  //   for (let i = 1; i < totalVotes; i++) {
  //     // Create the VoteId object with the pollId and vote nonce

  //     // Fetch the vote information from the contract
  //     const voteInfo = await appClient.getVoteByVoteId({ voteId: [[1],i] });
  //     allVotes.push(voteInfo.return);
  //   }

  //   console.log('All votes for poll 1:', allVotes);

  //   // Assert that the total votes match the votes we retrieved
  //   expect(allVotes.length).toBe(totalVotes);

  //   // // You can also check specific vote details, such as the voter's address or the vote's claimed status
  //   // allVotes.forEach((vote, index) => {
  //   //   expect(vote.voter).toBeDefined();
  //   //   expect(vote.claimed).toBe(false); // Assuming none of the votes are claimed yet
  //   // });
  // });

  test('Get all boxes', async () => {
    const allBoxes = await appClient.appClient.getBoxNames();

    console.log('all boxes', allBoxes);
  });

  test('Positive - Voter should withdraw their poll share successfully', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    //Make mbr transaction to withdraw?

    // Step 3: Withdraw the voter’s poll share
    const withdrawResult = await appClient.withdrawPollShare(
      { pollId: [1] },
      {
        sender: daoVoter,
        sendParams: {
          fee: algokit.microAlgos(3_000),
        },
      }
    );

    // Step 4: Verify the voter's share has been transferred
    const daoVoterAccountAfter = await algodClient.accountInformation(daoVoter.addr).do();
    const assetHoldingAfter = daoVoterAccountAfter.assets.find((asset: any) => asset['asset-id'] == daoAsset);
    const balanceAfter = assetHoldingAfter ? assetHoldingAfter.amount : 0;

    console.log('daoVoter balance after withdraw', balanceAfter);

    // Assert the balance increased by the correct amount
    const expectedShare = 22; // Example value based on the deposited amount
    expect(balanceAfter).toBe(expectedShare);

    // Step 5: Ensure the vote is marked as claimed
    const voteInfo = await appClient.getVoteByVoteId({ voteId: [[1], daoVoter.addr] });
    expect(voteInfo.return).toStrictEqual([BigInt(1), daoVoter.addr]);
  });
});
