import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import { WecoopRewardsClient } from '../contracts/clients/WecoopRewardsClient';
import algosdk, { Algodv2 } from 'algosdk';

//SETUP TESTS ------------------------------------------------------------------------------------------------------------------------------
const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: WecoopRewardsClient;
let wecoopTokenId: bigint;
let mainAccount: algosdk.Account;
let algodClient: Algodv2;
let algorandClient: algokit.AlgorandClient;

describe('WecoopRewards', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    const { algorand } = fixture;

    algorandClient = algorand;

    algodClient = algorand.client.algod;

    // Step 1: Create the WeCoop Token
    const createdAsset = (await algorand.send.assetCreate({ sender: testAccount.addr, total: BigInt(100_000) }))
      .confirmation.assetIndex;
    wecoopTokenId = BigInt(createdAsset!);

    mainAccount = testAccount;

    // Step 2: Set up the WecoopRewardsClient
    appClient = new WecoopRewardsClient(
      {
        sender: testAccount,
        resolveBy: 'id',
        id: 0,
      },
      algorand.client.algod
    );

    await appClient.create.createApplication({});
  });

  //BOOTSTRAP ------------------------------------------------------------------------------------------------------------------------------

  test('bootstrap', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();
    // Create a mock payment transaction
    const mbrTxn = algorandClient.send.payment({
      sender: mainAccount.addr,
      amount: algokit.algos(0.1 + 0.1),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    await appClient.bootstrap({ mbrTxn, asset: wecoopTokenId });

    // // Check if the app is opted into the token after bootstrapping
    // const isOptedIn = appClient.isOptedIn(wecoopTokenId);
    // expect(isOptedIn).toBe(true);
  });

  //BOOTSTRAP ------------------------------------------------------------------------------------------------------------------------------
  //SETUP TESTS ------------------------------------------------------------------------------------------------------------------------------

  //REWARD CYCLE 1 ------------------------------------------------------------------------------------------------------------------------------

  test('initiateRewardCycle', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    const axfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: mainAccount.addr,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
      to: appAddress,
      amount: 10_000,
      assetIndex: Number(wecoopTokenId),
    });

    await appClient.initiateRewardCycle({ axfer: axfer });

    const { reward_cycle: rewardCycle } = await appClient.getGlobalState();
    const { total_rewards: totalRewards } = await appClient.getGlobalState();

    expect(rewardCycle?.asNumber()).toBe(1);
    expect(totalRewards?.asNumber()).toBe(10_000);
  });

  test('createPost', async () => {
    // Step 3: Create an asset transfer transaction simulating a post creation
    const createPostAxfer = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: mainAccount.addr,
      to: mainAccount.addr,
      amount: 1, // simulate a small fee to post
      assetIndex: Number(wecoopTokenId),
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    try {
      appClient.optIn.optInToApplication({}, { sender: mainAccount });

      // Step 4: Call the createPost method
      await appClient.createPost(
        { axfer: createPostAxfer },
        {
          sender: mainAccount,
          sendParams: {
            fee: algokit.microAlgos(3_000),
          },
        }
      );
    } catch (error) {
      console.error(error);
    }

    // Step 5: Fetch global and local state to verify results
    const { total_rewards: totalRewards } = await appClient.getGlobalState();
    const userState = await appClient.getLocalState(mainAccount.addr);

    // // Assertions:
    // // 1. Reward pool should be reduced by the post creation reward (e.g., 10 units as per calculatePostReward)
    // expect(totalRewards?.asNumber()).toBe(10_000);

    // 2. User's claimed reward should be incremented by 10 units
    expect(userState?.claimed_amount?.asNumber()).toBe(5);
  });

  //REWARD CYCLE 1 ------------------------------------------------------------------------------------------------------------------------------

  // -----------------------------------------------------------------------------------------------------------
});
