/* eslint-disable camelcase */
import { describe, test, beforeAll, beforeEach } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import * as algokit from '@algorandfoundation/algokit-utils';
import algosdk, { Algodv2, encodeAddress } from 'algosdk';
import { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account';
import { WecoopFilePostClient } from '../contracts/clients/WecoopFilePostClient';

const fixture = algorandFixture();
algokit.Config.configure({ populateAppCallResources: true });

let appClient: WecoopFilePostClient;

//------------------------------------------------------------
// Involved wallets
let wecoop_manager_account: TransactionSignerAccount;
let user_account: TransactionSignerAccount;
//------------------------------------------------------------

let allInvolvedAccounts: TransactionSignerAccount[];

//------------------------------------------------------------
// Involved clients
let algorandClient: algokit.AlgorandClient;
let algodClient: Algodv2;
//------------------------------------------------------------

// Involved assets
let communityCoin: number | bigint | undefined;

describe('WecoopFilePost', () => {
  beforeEach(fixture.beforeEach);

  beforeAll(async () => {
    await fixture.beforeEach();
    const { testAccount } = fixture.context;
    const { algorand } = fixture;

    algorandClient = algorand;
    algodClient = algorand.client.algod;

    // Set important accounts
    // 1- append variable values
    wecoop_manager_account = testAccount;
    user_account = await algorandClient.account.kmd.getOrCreateWalletAccount('devs-account', algokit.algos(100));

    allInvolvedAccounts = [wecoop_manager_account, user_account];

    // Fund the new wallet with some algos
    await algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      receiver: user_account.addr,
      amount: algokit.microAlgos(1_000_000), // Send 1 Algo to the new wallet
    });

    //------------------------------------------------------------

    // 2 - Creating the asset that will be used to represent the community coin that will be used as effort1
    communityCoin = (
      await algorand.send.assetCreate({ sender: wecoop_manager_account.addr, total: BigInt(10_000_000), decimals: 6 })
    ).confirmation.assetIndex;

    appClient = new WecoopFilePostClient(
      {
        sender: wecoop_manager_account,
        resolveBy: 'id',
        id: 0,
      },
      algorand.client.algod
    );

    await appClient.create.createApplication({});
  });

  test('App account should opt-in to the asset', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    // Create mbr transaction to opt contract to the poll asset
    const mbrTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.1 + 0.047),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    const result = await appClient.optinToAsset({ assetId: communityCoin!, mbrTxn });

    console.log('result of optin in', result);
  });

  test('User should be able to create a post', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    const mbrTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.00447),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    const fundTransaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: appAddress,
      assetIndex: Number(communityCoin!),
      amount: 1,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    const payTransaction = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: appAddress,
      assetIndex: Number(communityCoin!),
      amount: 1,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    algokit.sendTransaction({ transaction: fundTransaction, from: wecoop_manager_account }, algodClient);

    const result = await appClient.createFilePost({
      mbrTxn,
      text: 'My name is arthur rabelo and I dont care about shit anymore',
      cid: 'QmWKHPo5oBLciKERd6NGrjsjHbQror89tLxqiE9ZyJLoCF',
      country: 'BR',
      axfer: payTransaction,
      fileFormat: 'png',
    });

    console.log('create file post result', result);
  });

  test('get all file posts', async () => {
    const { appId } = await appClient.appClient.getAppReference();

    // eslint-disable-next-line no-use-before-define
    const result = await getAllFilePosts(Number(appId));
    console.log('File posts:', result);
  });

  async function getAllFilePosts(wecoopAppId: number) {
    const boxesResponse = await algodClient.getApplicationBoxes(wecoopAppId).do();

    const allFilePosts: Array<{ postId: number; data: any }> = [];
    const decoder = new TextDecoder('utf-8');

    for (const box of boxesResponse.boxes) {
      const boxNameBytes = box.name;

      try {
        // Decode Post ID (nonce)
        const postIdBytes = boxNameBytes.slice(0, 8);
        const postId = new DataView(postIdBytes.buffer).getBigUint64(0, false);

        // Retrieve and decode the box content (PostData)
        const postDataBytes = await algodClient.getApplicationBoxByName(wecoopAppId, box.name).do();
        const contentBytes = postDataBytes.value;
        let offset = 0;

        // Decode creator_address (32 bytes)
        const creatorAddressBytes = contentBytes.slice(offset, offset + 32);
        const creatorAddress = encodeAddress(creatorAddressBytes);
        offset += 32;

        // Decode timestamp (8 bytes)
        const timestampBytes = contentBytes.slice(offset, offset + 8);
        const timestamp = new DataView(timestampBytes.buffer).getBigUint64(0, false);
        offset += 8;

        // Decode likes (8 bytes)
        const likesBytes = contentBytes.slice(offset, offset + 8);
        const likes = new DataView(likesBytes.buffer).getBigUint64(0, false);
        offset += 8;

        // Decode replies (8 bytes)
        const repliesBytes = contentBytes.slice(offset, offset + 8);
        const replies = new DataView(repliesBytes.buffer).getBigUint64(0, false);
        offset += 8;

        // Decode strikes (8 bytes)
        const strikesBytes = contentBytes.slice(offset, offset + 8);
        const strikes = new DataView(strikesBytes.buffer).getBigUint64(0, false);
        offset += 8;

        // Decode asset_id (8 bytes)
        const assetIdBytes = contentBytes.slice(offset, offset + 8);
        const assetId = new DataView(assetIdBytes.buffer).getBigUint64(0, false);
        offset += 12;

        // **Fix 1: Correctly Decode `country` (2 bytes)**
        const countryBytes = contentBytes.slice(offset, offset + 8);
        const country = decoder.decode(countryBytes);
        offset += 10;

        // Use a regex or manual method to extract 'CA' from the special characters
        const countryMatch = country.match(/[A-Z]{2}/); // Find two uppercase letters
        const countryCode = countryMatch ? countryMatch[0] : ''; // Extract 'CA' or fallback to an empty string

        // Read the file_cid string based on the length
        const fileCidBytes = contentBytes.slice(offset, offset + 46);
        const fileCid = decoder.decode(fileCidBytes);
        offset += 48;
        // **Remove unnecessary offset increment**
        // offset += 10; // Remove this line

        // Decode file_format (3 bytes)
        const fileFormatBytes = contentBytes.slice(offset, offset + 3);
        const fileFormat = decoder.decode(fileFormatBytes);
        offset += 3;

        // // **Fix 2: Uncomment and Decode `text` Field**
        // // Read the length of text (2 bytes)
        // const textLengthBytes = contentBytes.slice(offset, offset + 2);
        // const textLength = new DataView(textLengthBytes.buffer).getUint16(0, false);
        // offset += 2;

        // Read the text string based on the length
        const textBytes = contentBytes.slice(offset);
        const text = decoder.decode(textBytes).trim();

        // Construct the PostData object
        const postData: unknown = {
          creator_address: creatorAddress,
          timestamp: Number(timestamp),
          likes: Number(likes),
          replies: Number(replies),
          strikes: Number(strikes),
          asset_id: Number(assetId),
          country: countryCode,
          file_cid: fileCid,
          file_format: fileFormat,
          text, // Include the text field
        };

        // Add the post data to the list
        allFilePosts.push({
          postId: Number(postId),
          data: postData,
        });
      } catch (error) {
        console.error('Error decoding file post:', error);
      }
    }

    return allFilePosts;
  }

  test('User is supposed to be able to like a file post', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    const mbrTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.02),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    const platformAlgoFeeTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.1),
      receiver: wecoop_manager_account.addr,
      extraFee: algokit.algos(0.001),
    });

    const creatorPayTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: wecoop_manager_account.addr,
      assetIndex: Number(communityCoin!),
      amount: 1,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    const platformCommunityFeeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: wecoop_manager_account.addr,
      assetIndex: Number(communityCoin!),
      amount: 2,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    const result = await appClient.likeFilePost({
      mbrTxn,
      filePostId: [1],
      platformAlgoFeeTxn,
      platformCommunityFeeTxn,
      creatorPayTxn,
    });

    console.log('result', result);
  });

  test('User is supposed to be able to reply a file post', async () => {
    const { appAddress } = await appClient.appClient.getAppReference();

    const mbrTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.02),
      receiver: appAddress,
      extraFee: algokit.algos(0.001),
    });

    const platformAlgoFeeTxn = algorandClient.send.payment({
      sender: wecoop_manager_account.addr,
      amount: algokit.algos(0.1),
      receiver: wecoop_manager_account.addr,
      extraFee: algokit.algos(0.001),
    });

    const creatorPayTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: wecoop_manager_account.addr,
      assetIndex: Number(communityCoin!),
      amount: 1,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    const platformCommunityFeeTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      from: wecoop_manager_account.addr,
      to: wecoop_manager_account.addr,
      assetIndex: Number(communityCoin!),
      amount: 2,
      suggestedParams: await algokit.getTransactionParams(undefined, algodClient),
    });

    const result = await appClient.replyFilePost({
      mbrTxn,
      filePostId: [1],
      platformAlgoFeeTxn,
      platformCommunityFeeTxn,
      creatorPayTxn,
      text: 'This post realy good',
      assetId: Number(communityCoin),
      country: 'CA',
    });

    console.log('result', result);
  });

  test('get all filepost likes and comments', async () => {
    const { appId } = await appClient.appClient.getAppReference();

    const allBoxeNames = await appClient.appClient.getBoxNames();

    const likeBoxes = allBoxeNames.filter((boxName) => boxName.name.split('_')[0] === 'filePostLike');

    console.log('like boxes', likeBoxes);

    const boxValues = await Promise.all(
      allBoxeNames.map(async (box) => await algodClient.getApplicationBoxByName(Number(appId), box.nameRaw).do())
    );

    const decoder = new TextDecoder('utf-8');
  });
});
